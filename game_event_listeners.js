 const instr_button = document.getElementById('instructions_link');
 instr_button.addEventListener('click', () => {
     const popup = document.querySelector('.popup');
     popup.classList.add('active');

     const backdrop = document.querySelector('.backdrop');
     backdrop.classList.add('active');
 });

 const backdrop = document.querySelector('.backdrop');
 backdrop.addEventListener('click', () => {
     backdrop.classList.remove('active');
    
     const popup = document.querySelector('.popup');
     popup.classList.remove('active');
 });

 const chat_button = document.getElementById('chat_input_text');
 chat_button.addEventListener('keydown', (e) => {
     if(e.key === 'Enter') {
         submitChat();
     }
 });
