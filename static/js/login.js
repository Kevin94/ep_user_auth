var getBaseUrl = function(){
	var  loc = document.location;
	var port = loc.port == "" ? (loc.protocol == "https:" ? 443 : 80) : loc.port;
	var url = loc.protocol + "//"+ loc.hostname +":"+ loc.port
	var pathComponents = location.pathname.split('/');
	pathComponents.pop(); //drop filename
	var lastDir = pathComponents[pathComponents.length -1];
	if(lastDir == "p") //add other posibilities
		pathComponents.pop();
	baseURL = pathComponents.join('/') + '/';

	url = url + baseURL;
	return url;
};

exports.postAceInit = function(hooks, context, cb){
	$("#error").hide();
	
	$.ajax({
		type: 'POST',
		data: JSON.stringify({}),
		contentType: 'application/json',
		url: data.url + 'getUser',	
		success: function(data) {
			if(data.success){
				$("#loginForm").hide();
				$("#logout").show();
				if(context.pad.getUserId() != data.user.author) {
					if(data.user.token) {
						pad.createCookie("token",data.user.token);
						location.reload(true);
					} else {
						alert("Something went wrong, please relogin!");
					}
				}
			}else{
				$("#logout").hide();
			};	
		},
		error: function (xhr, ajaxOptions, thrownError) {
			//console.log(thrownError);
			if(xhr.statusCode() == 405)
				alert("Server bitte neustarten");
		}
	});
	
	$("#login").click(function(e) {
		$("#error").hide();
		e.preventDefault();
		var data = {};
		data.email = $("#email").val();
		data.password = $("#password").val();
		data.url = getBaseUrl();
		data.readOnlyId = context.pad.getPadId();
		
		$.ajax({
			type: 'POST',
			data: JSON.stringify(data),
			contentType: 'application/json',
			url: data.url + 'login',	
			success: function(data) {
				if(data.success){
					if(data.padId) {
						window.location.href = getBaseUrl()+"p/"+data.padId;
					} else {
						window.location.href = getBaseUrl();
					}
				} else {
					$("#error").html(data.error).show();
				};	
			},
			error: function (xhr, ajaxOptions, thrownError) {
				if(xhr.statusCode() == 405)
					alert("Server bitte neustarten");
			}
		});
	});
	
	$("#logout").click(function(e) {
		e.preventDefault();
		var data = {};
		data.url = getBaseUrl();
		data.padId = context.pad.getPadId();
		
		$.ajax({
			type: 'POST',
			data: JSON.stringify(data),
			contentType: 'application/json',
			url: data.url + 'logout',	
			success: function(data) {
				if(data) {
					window.location.href = getBaseUrl();
				} else {
					//console.log(data.error);
					$("#error").val("Logout returned false?").show().delay(2000).fadeOut(1000);
				};	
			},
			error: function (xhr, ajaxOptions, thrownError) {
				//console.log(thrownError);
				if(xhr.statusCode() == 405)
					alert("Server bitte neustarten");
			}
		});
	});
	
	
};
