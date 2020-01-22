function e(){
    var tag_name = arguments[0]
    var tag_attrs_or_child = arguments[1]
    var child_begins = 2
    var tag_attrs = tag_attrs_or_child
    if(tag_attrs_or_child && !$.isPlainObject(tag_attrs_or_child)){
        child_begins = 1
        tag_attrs = null
    }

    var $e = $('<'+ tag_name +'>')

    if(tag_attrs){
        $.each(tag_attrs, function(k, v){
            if(k === 'style'){
                $e.css(v)
            }
            else{
                $e.attr(k, v)
            }
        })
    }

    for(var i=child_begins; true; i++){
        if(arguments.hasOwnProperty(i)){
            var arg = arguments[i]
            $e.append(arg)
        }
        else{
            break
        }
    }

    return $e
}
