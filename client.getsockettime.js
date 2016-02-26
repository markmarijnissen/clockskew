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

ClockSkew.getSocketTime = getSocketTime;