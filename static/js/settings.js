$(function(){
    function xhrError(xhr, ajaxOptions, thrownError) {
        //console.log(thrownError);
        if(xhr.statusCode() == 405)
            alert("Server bitte neustarten");
    }
    
    $("#subscription ~ form").hide();
    $("#name ~ form").hide();
    $("#password ~ form").hide();
    $("#subscription").click(function(e){
        $("#subscription ~ form").slideDown();
        $("#name ~ form").slideUp();
        $("#password ~ form").slideUp();
    });
    $("#name").click(function(e){
        $("#subscription ~ form").slideUp();
        $("#name ~ form").slideDown();
        $("#password ~ form").slideUp();
    });
    $("#password").click(function(e){
        $("#subscription ~ form").slideUp();
        $("#name ~ form").slideUp();
        $("#password ~ form").slideDown();
    });
    
    $("#error").hide(); 
    
    $("#submitSubscription").click(function(e){
        e.preventDefault();
        var data = {
            action: "settings", 
            onStart: $("input[name=onStart]").prop("checked"),
            onEnd: $("input[name=onEnd]").prop("checked")
        };
        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: baseUrl + 'subscribe',  
            success: function(data) {
                if(data.success){
                    $("#error").hide(); 
                }else{
                    $("#error").html(data.error).slideDown();
                };
            },
            error: xhrError
        });
        
    });
    $("#submitNames").click(function(e){
        e.preventDefault();
        var data = {
            newUserName: $("input[name=fullname]").val(),
            newAuthorName: $("input[name=displayName]").val()
        };
        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: baseUrl + 'changeUserName',  
            success: function(data) {
                if(data.success){
                    $("#error").hide(); 
                }else{
                    $("#error").html(data.error).slideDown();
                };  
            },
            error: xhrError
        });
        
    });
    $("#submitPassword").click(function(e){
        e.preventDefault();
        var data = {
            newPW: $("input[name=passwordNew]").val(),
            oldPW: $("input[name=passwordOld]").val()
        };
        if(data.newPW != $("input[name=passwordNewRepeat]").val()) {
            $("#error").html("New Passwords do not match!").slideDown();
            return;
        }
        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: baseUrl + 'changeUserPw',  
            success: function(data) {
                if(data.success){
                    $("#error").hide(); 
                }else{
                    $("#error").html(data.error).slideDown();
                };  
            },
            error: xhrError
        });
        
    });
    
});