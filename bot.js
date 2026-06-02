module.exports = {
    botMoveState: function (ball_x, ball_y, ball_vx, ball_va,
                     paddle_ypos, paddle_xpos) {
        //returns the appropriate paddle state given ball position / velocity
        //and which side the bot is on.
        
        //we can make this conditional neater via math later.
        if((paddle_xpos < 0 && ball_vx < 0)||
           (paddle_xpos > 0 && ball_vx > 0)) {

           if(ball_y > paddle_ypos) {
               return 'up';
           } else if(ball_y < paddle_ypos) {
               return 'down';
        }

        return 'neutral';
    }
};
