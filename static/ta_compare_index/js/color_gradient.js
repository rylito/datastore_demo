function ColorGradient(container_id){


    // generate color based on percent value of td
    function get_color(val){
        //value from 0 to 1
        value_floored = Math.floor(val*1.0/10);
        val = value_floored/10
        var hue = ((val) * 120).toString(10);
        var lightness = '50';
        return ["hsl(", hue, ",100%,",lightness,"%)"].join("");
    }

    function build_color_legend() {
        $color_map = e('div',
            e('h3', 'Color Map'),
            e('ul', {'class': 'color-map'},
                function(){
                    var $rows = []
                    for (var i = 0.0; i <= 100.0; i += 10.0){
                        $rows.push(e('li', {'style': {'background-color': get_color(i)}}, i))
                    }
                    return $rows
                }
            )
        )

        $(container_id).append($color_map)
    }

    //init actions
    build_color_legend()


    // public methods

    this.get_color = function(val){
        return get_color(val)
    }
}
