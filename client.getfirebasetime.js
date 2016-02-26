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

ClockSkew.getFirebaseTime = getFirebaseTime;
