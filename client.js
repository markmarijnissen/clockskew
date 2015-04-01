(function(){
var getTime = Date.now;
if(typeof window !== 'undefined' && typeof window.performance !== 'undefined'){
	getTime = function getPerformanceTime(){
		return performance.timing.navigationStart + performance.now();
	};
}

function average(data){
  var sum = data.reduce(function(sum, value){
    return sum + value;
  }, 0);
 
  var avg = sum / data.length;
  return avg;
}

function std(values,avg){
	return Math.sqrt(average(values.map(function(value){
		var diff = value - avg;
	    return diff * diff;
	})));
}

function getHttpTime(url,getTime,callback) {
	var start,end;
	xhr = new XMLHttpRequest();
  	xhr.open('GET', url);
  	xhr.onreadystatechange = function() {
  		if(xhr.readyState === 2){
	    	end = getTime();
	    } else if (xhr.readyState == 4) {
	    	if(xhr.status === 200){
	    		callback(null,[start,xhr.responseText * 1.0,end]);
	    	} else {
	    		callback(xhr.status,xhr.responseText);
	    	}
		}
	};
	xhr.send();
	start = getTime();
}

function getFirebaseTime(url,getTime,callback) {
	var ref = new Firebase(url);
	var start = null;
	ref.set(Firebase.ServerValue.TIMESTAMP);
	ref.on('value',function(snap){
		if(start === null){
			start = getTime();
		} else {
			end = getTime();
			callback(null,[start,snap.val(),end]);
			ref.off();
		}
	});
}

function getSocketTime(url){
	var websocket;
	var queue = [];
	function create(){
		queue.splice(1);
		if(websocket) websocket.close();
		websocket = new WebSocket(url); 
		websocket.onopen = function(){
			websocket.send('?');
		};
		websocket.onmessage = function(e){
			var stuff = queue.shift();
			if(stuff){
				stuff[0](null,[stuff[1],e.data,stuff[2]()]);	
			}
		};
		websocket.onerror = function(){
			websocket.close();
			websocket = null;
		};
	}
	
	return function get(getTime,callback){
		var start = getTime();
		queue.push([callback,start,getTime]);
		if(!websocket || websocket.readyState > 1) {
			create();
		} else {
			websocket.send('?');	
		}
		
	};
}


/**
 * CLIENT               SERVER
 *
 *	 A ------ set time ---->
 *                         |
 *                         B (server time)
 *                         |
 *   C <----- get time -----
 *
 *
 *	 Assuming network latency is symmetrical,
 *	 i.e. equal for sending and receiving,
 *	 we can say:
 * 
 *   Network latency: (C - A) / 2
 *
 *   So we expect server time to be: 0.5 * (A + C)
 *   i.e. in the middle between A and C.
 *
 *   We can compare this to the reported server time (B)
 *   to estimate clock skew.
 *
 *   Clock Skew = B - 0.5 * (A+C)
 *
 *   As network latency (ping) will change, 
 *   we can sample the average of the latest N samples.
 *
 *   We will reject measurements that are more then 2 standard deviations away.
 * 
 */	
function ClockSkew(options){
	this.options = options = options || {};
	this.options.timeout = options.timeout || 10000;
	this.options.interval = options.interval || 1000;
	this.options.waitInterval = options.waitInterval || this.options.interval * 30; // 30 sec
	this.options.minRttValues = options.minRttValues || 5;
	this.options.minSkewValues = options.minSkewValues || 5;
	this.options.history = options.history || 10;
	this.options.tolerance = options.tolerance || 2;
	this.setTimeout = options.setTimeout || function(fn,time) { return setTimeout(fn,time); };
	this.clearTimeout = options.clearTimeout || function(id) { return clearTimeout(id); };

	if(options.getServerTime){
		this.getServerTime = options.getServerTime.bind(null,options.getTime || getTime);
	} else {
		throw new Error('getServerTime is a required option');
	}

	this.skew = 0;
	this.rttValues = [];
	this.rawSkewValues = [];
	this.avgSkewValues = [];
	this.timerId = 0;
	this.calculate = this.calculate.bind(this);
	this.onServerTime = this.onServerTime.bind(this);
}

ClockSkew.getTime = getTime;
ClockSkew.getFirebaseTime = getFirebaseTime;
ClockSkew.getHttpTime = getHttpTime;
ClockSkew.getSocketTime = getSocketTime;

ClockSkew.prototype.start = function(){
	//this.reset();
	if(this.timerId) this.clearTimeout(this.timerId);
	this.timerId = this.setTimeout(this.calculate,this.options.interval || 1000);
};

ClockSkew.prototype.calculate = function(){
	this.getServerTime(this.onServerTime);
};

ClockSkew.prototype.onServerTime = function(err,t){
	if(err) return;
	var interval = this.options.interval;
	var averageSkewStd, skewStd, rttStd;
	
	// Calculate Round Trip Time (RTT)
	var rtt = t[2] - t[0];
	if(rtt < 0 || isNaN(rtt)){
		if(this.options.log) console.log('clockSkew: No local time has passed!',rtt);
		this.setTimeout(this.calculate,interval);
		return;
	}
	this.rttValues.unshift(rtt);
	this.rttValues.splice(this.options.history);
	this.rtt = rtt;
	if(rtt > this.options.timeout) {
		if(this.options.log) console.log('clockSkew: Abort. RTT timeout',rtt);
		this.setTimeout(this.calculate,interval);
		return;
	}

	// If we have enough samples
	if(this.rttValues.length >= this.options.minRttValues){
		var avgRtt = average(this.rttValues);
		// Calculate STD of RTT
		rttStd = std(this.rttValues,avgRtt);
		// Abort if RTT values is more than 1 STD away
		if(rttStd > 0 && rtt - avgRtt > 1*rttStd) {
			if(this.options.log) console.log('clockSkew: Abort. STD of RTT value > 1',rtt);
			this.setTimeout(this.calculate,interval);
			return;
		}
	}

	var estimatedLocalTime = 0.5 * (t[0] + t[2]);
	var skew = estimatedLocalTime - t[1];
	var avg = average(this.rawSkewValues);

	if(this.rawSkewValues.length >= this.options.minSkewValues){
		// if skew changes very much, time-jump and reset!
		if(Math.abs(skew - avg) > 150){
			if(this.options.log) console.log('reset. now='+skew+' avg='+avg+' diff='+Math.abs(skew - avg));
			this.reset();
		}
	}

	this.rawSkewValues.unshift(skew);
	this.rawSkewValues.splice(this.options.history);
	avg = average(this.rawSkewValues);
	this.skew = avg;

	this.avgSkewValues.unshift(avg);
	this.avgSkewValues.splice(this.options.history);

	// Check if we have a stable value
	if(this.avgSkewValues.length >= this.options.minSkewValues){
		// Calculate average skew difference with current value
		averageSkewStd = std(this.avgSkewValues,average(this.avgSkewValues));
		// YES, stable value. Schedule next check in later time
		if(averageSkewStd < this.options.tolerance) {
			if(this.options.log) console.log('clockSkew - stable value:',averageSkewStd);
			interval = this.options.waitInterval;
			//this.reset();
		}
	}

	// Fire Callback
	if(this.options.onSkew && !isNaN(this.skew)) {
		this.options.onSkew(this.skew);
	}
	if(this.options.log) console.log('clockSkew',this.skew,Math.round(this.rtt),averageSkewStd);

	// Schedule next check
	this.setTimeout(this.calculate,interval);
};

ClockSkew.prototype.reset = function(){
	// Reset history arrays
	this.rttValues = [];
	this.avgSkewValues = [];
	this.rawSkewValues = [];
};


ClockSkew.prototype.stop = function(){
	this.clearTimeout(this.timerId);
};

if(typeof module !== 'undefined'){
	module.exports = ClockSkew;	
} else {
	window.ClockSkew = ClockSkew;
}
})();