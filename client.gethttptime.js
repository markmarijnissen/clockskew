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

ClockSkew.getHttpTime = getHttpTime;
