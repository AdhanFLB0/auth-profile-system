<script>
    // ESTADO
    const state = { id_participante: null, codigo: '', questions: [], currentIdx: 0, answers: [], logs: [], startTime: 0, timerInterval: null, score: 0 };
    
    function show(id) { document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); }
    function goRegistration() { show('screen-register'); log('view_registration'); }
    
    // --- FUNÇÃO ESPIÃO ---
    function log(type, details={}) { 
        state.logs.push({ timestamp: Date.now(), event_type: type, details: {...details, q: state.currentIdx} }); 
    }

    // REGISTRO
    document.getElementById('form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled = true; btn.innerText = "Carregando...";
      const data = { idade: document.getElementById('reg-idade').value, genero: document.getElementById('reg-genero').value, escolaridade: document.getElementById('reg-escolaridade').value, nivel_ia: document.getElementById('reg-ia').value };
      try {
        const res = await fetch('IAHmp4registro.php', { method: 'POST', body: JSON.stringify(data) });
        const json = await res.json();
        if (json.success) { 
            state.id_participante = json.id_participante; state.codigo = json.codigo_gerado; 
            document.getElementById('user-code').innerText = state.codigo; 
            show('screen-intro');
            log('registration_success');
        } else { alert(json.error); btn.disabled = false; }
      } catch (err) { alert('Erro conexão'); btn.disabled = false; }
    });

    // INICIAR
    async function startQuiz() {
      try {
        const res = await fetch('IAHmp4buscar.php');
        state.questions = await res.json();
        if(state.questions.length===0) throw new Error("Sem vídeos.");
        log('quiz_start'); show('screen-quiz'); loadQuestion();
      } catch(e) { alert(e.message); }
    }

    function getYoutubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    // CARREGAR PERGUNTA (Com Espião de Vídeo)
    function loadQuestion() {
      const q = state.questions[state.currentIdx];
      const mediaDiv = document.getElementById('media-wrapper');
      const inputsDiv = document.getElementById('dynamic-inputs');
      const justInput = document.getElementById('quiz-justificativa');

      document.getElementById('quiz-question').innerText = q.texto;
      mediaDiv.className = (q.modo === 'comparativo') ? 'media-container dual' : 'media-container';
      mediaDiv.innerHTML = '';
      
      q.urls.forEach((url) => {
          const vidId = getYoutubeId(url);
          const wrapper = document.createElement('div');
          wrapper.className = 'video-wrapper';
          
          // ESPIÃO: Detecta mouse sobre a área do vídeo
          wrapper.onmouseenter = () => log('video_hover_enter');
          
          if(vidId) {
              const iframe = document.createElement('iframe');
              iframe.src = `https://www.youtube.com/embed/${vidId}?rel=0&modestbranding=1`;
              iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
              iframe.allowFullscreen = true;
              wrapper.appendChild(iframe);
          } else { wrapper.innerText = "Erro URL"; }
          
          mediaDiv.appendChild(wrapper);
      });

      // Inputs
      inputsDiv.innerHTML = ''; justInput.value = ''; justInput.required = false; document.getElementById('label-justificativa').innerText = 'Comentário (Opcional):';
      let html = '';

      if (q.modo === 'padrao') {
          html += `<label class="radio-option"><input type="radio" name="choice" value="ia_certeza" required> É IA (Certeza)</label> <label class="radio-option"><input type="radio" name="choice" value="ia_duvida"> É IA (Dúvida)</label> <label class="radio-option"><input type="radio" name="choice" value="humano_certeza"> É Humano (Certeza)</label> <label class="radio-option"><input type="radio" name="choice" value="humano_duvida"> É Humano (Dúvida)</label>`;
      } else if (q.modo === 'comparativo') {
          html += `<label class="radio-option"><input type="radio" name="choice" value="video_a" required> A (Esq) é IA</label> <label class="radio-option"><input type="radio" name="choice" value="video_b"> B (Dir) é IA</label>`;
      } else if (q.modo === 'analise') {
          html += `<label class="radio-option"><input type="radio" name="choice" value="concordo" required> Concordo</label> <label class="radio-option"><input type="radio" name="choice" value="discordo"> Discordo</label>`;
      } else if (q.modo === 'aberta') {
          justInput.required = true; document.getElementById('label-justificativa').innerText = 'Sua Resposta (Obrigatória):'; html += `<input type="hidden" name="choice" value="texto_livre">`;
      }
      inputsDiv.innerHTML = html;

      if(state.timerInterval) clearInterval(state.timerInterval);
      state.startTime = Date.now();
      document.getElementById('timer-count').innerText = "0";
      state.timerInterval = setInterval(() => { document.getElementById('timer-count').innerText = Math.floor((Date.now()-state.startTime)/1000); }, 1000);
      
      log('view_question', { id: q.item_id, modo: q.modo });
    }

    // RESPONDER
    document.getElementById('form-quiz').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const q = state.questions[state.currentIdx];
      const choice = formData.get('choice');
      
      let isCorrect = false;
      if (q.modo === 'padrao') isCorrect = choice.startsWith(q.gabarito);
      else if (q.modo === 'comparativo') isCorrect = (choice === q.gabarito);
      else isCorrect = true;

      if(isCorrect) state.score++;

      state.answers.push({
        id: q.item_id, pergunta: q.texto, choice: choice, isCorrect: isCorrect,
        timeTaken: (Date.now() - state.startTime)/1000,
        justificativa: document.getElementById('quiz-justificativa').value
      });

      log('answer_submit');
      state.currentIdx++;
      if(state.currentIdx < state.questions.length) loadQuestion(); else finishQuiz();
    });

    async function finishQuiz() {
      show('screen-end');
      document.getElementById('final-score').innerText = `${state.score} / ${state.questions.length}`;
      await fetch('IAHmp4salvar.php', { method: 'POST', body: JSON.stringify({ id_participante: state.id_participante, respostas: state.answers, logs: state.logs }) });
    }
    
    // --- ESPIÕES GLOBAIS ---
    document.addEventListener("visibilitychange", () => log(document.visibilityState === 'hidden' ? 'tab_hidden' : 'tab_visible'));
    document.addEventListener("click", (e) => { if(!e.target.closest('button')) log('screen_click', {x:e.clientX, y:e.clientY}); });
</script>
