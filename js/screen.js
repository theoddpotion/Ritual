var Screen = function(width, height){
    this.canvas = document.createElement('canvas');

    this.width = width;
    this.height = height;

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    document.body.appendChild(this.canvas);

    this.context = this.canvas.getContext('2d');

};

Screen.prototype = {
    fillRect: function(x, y, w, h, color){
        this.context.fillStyle = color;
        this.context.fillRect(x, y, w, h);
    }
};