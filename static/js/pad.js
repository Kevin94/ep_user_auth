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

function xhrError(xhr, ajaxOptions, thrownError) {
    //console.log(thrownError);
    if(xhr.statusCode() == 405)
        alert("Server bitte neustarten");
}

exports.postAceInit = function(hooks, context, cb){
    var baseUrl = getBaseUrl();
	$("#error").hide();
	
	$.ajax({
		type: 'POST',
		data: JSON.stringify({}),
		contentType: 'application/json',
		url: baseUrl + 'getUser',	
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
		error: xhrError
	});
	
	$("#login").click(function(e) {
		$("#error").hide();
		e.preventDefault();
		
		$.ajax({
			type: 'POST',
			data: JSON.stringify({
	            email : $("#email").val(),
	            password : $("#password").val(),
	            url : baseUrl,
	            readOnlyId : context.pad.getPadId()
	        }),
			contentType: 'application/json',
			url: baseUrl + 'login',	
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
			error: xhrError
		});
	});
	
	$("#logout").click(function(e) {
		e.preventDefault();
		
		$.ajax({
			type: 'POST',
			data: JSON.stringify({
	            url : baseUrl,
	            padId : context.pad.getPadId()
	        }),
			contentType: 'application/json',
			url: baseUrl + 'logout',	
			success: function(data) {
				if(data) {
					window.location.href = getBaseUrl();
				} else {
					$("#error").val("Logout returned false?").show().delay(2000).fadeOut(1000);
				};	
			},
			error: xhrError
		});
	});
	
    $.ajax({
        type: 'POST',
        data: JSON.stringify({action: "status", padId: context.pad.getPadId()}),
        contentType: 'application/json',
        url: baseUrl + 'subscribe',  
        success: function(data) {
            if(data.success){
                $('#options-emailNotifications').prop('checked', data.status);
            }else{
                //TODO
            };  
        },
        error: xhrError
    });

    $('#options-emailNotifications').on('click', function() {
        var action = $('#options-emailNotifications').prop("checked") ? "set" : "clear";
        $.ajax({
            type: 'POST',
            data: JSON.stringify({action: action, padId: context.pad.getPadId()}),
            contentType: 'application/json',
            url: baseUrl + 'subscribe',  
            success: function(data) {
                //TODO
                if(data.success){
                }else{
                };  
            },
            error: xhrError
        });
    });
};
