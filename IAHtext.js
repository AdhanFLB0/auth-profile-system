 <script>
    const state = { id_participante: null, codigo: '', questions: [], currentIdx: 0, answers: [], logs: [], startTime: 0, timerInterval: null, score: 0 };
    
    function show(id) { document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); }
    function goRegistration() { show('screen-register'); }
    function log(type, details={}) { state.logs.push({ timestamp: Date.now(), event_type: type, details: {...details, q: state.currentIdx} }); }

    // REGISTRO
    document.getElementById('form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled = true; btn.innerText = "Gerando ID...";
      const data = { 
        idade: document.getElementById('reg-idade').value, genero: document.getElementById('reg-genero').value, 
        escolaridade: document.getElementById('reg-escolaridade').value, nivel_ia: document.getElementById('reg-ia').value 
      };
      try {
        const res = await fetch('IAHtextregistro.php', { method: 'POST', body: JSON.stringify(data) });
        const json = await res.json();
        if (json.success) { state.id_participante = json.id_participante; state.codigo = json.codigo_gerado; document.getElementById('user-code').innerText = state.codigo; show('screen-intro'); }
        else { alert(json.error); btn.disabled = false; }
      } catch (err) { alert('Erro conexão'); btn.disabled = false; }
    });

    // INICIAR
    async function startQuiz() {
      try {
        const res = await fetch('IAHtextbuscar.php');
        state.questions = await res.json();
        if(state.questions.length===0) throw new Error("Banco de textos vazio.");
        log('start'); show('screen-quiz'); loadQuestion();
      } catch(e) { alert(e.message); }
    }

    // CARREGAR PERGUNTA
    function loadQuestion() {
      const q = state.questions[state.currentIdx];
      const inputsDiv = document.getElementById('dynamic-inputs');
      const justInput = document.getElementById('quiz-justificativa');
      const mediaDiv = document.getElementById('media-wrapper');

      document.getElementById('progress-text').innerText = `Texto ${state.currentIdx + 1}/${state.questions.length}`;
      document.getElementById('quiz-question').innerText = q.texto;
      
      mediaDiv.className = (q.modo === 'comparativo') ? 'media-container dual' : 'media-container';
      mediaDiv.innerHTML = '';
      
      q.conteudos.forEach((texto, i) => {
          const card = document.createElement('div');
          card.className = 'text-card';
          card.innerText = texto;
          mediaDiv.appendChild(card);
      });

      inputsDiv.innerHTML = '';
      justInput.value = ''; justInput.required = false;
      document.getElementById('label-justificativa').innerText = 'Observação (Opcional):';

      let html = '';
      if (q.modo === 'padrao') {
          html += `<label class="radio-option"><input type="radio" name="choice" value="ia_certeza" required> É IA (Certeza)</label>`;
          html += `<label class="radio-option"><input type="radio" name="choice" value="ia_duvida"> É IA (Dúvida)</label>`;
          html += `<label class="radio-option"><input type="radio" name="choice" value="humano_certeza"> É Humano (Certeza)</label>`;
          html += `<label class="radio-option"><input type="radio" name="choice" value="humano_duvida"> É Humano (Dúvida)</label>`;
      } else if (q.modo === 'comparativo') {
          html += `<label class="radio-option"><input type="radio" name="choice" value="texto_a" required> Texto da Esquerda (A) é IA</label>`;
          html += `<label class="radio-option"><input type="radio" name="choice" value="texto_b"> Texto da Direita (B) é IA</label>`;
      } else if (q.modo === 'analise') {
          html += `<label class="radio-option"><input type="radio" name="choice" value="concordo" required> Concordo</label>`;
          html += `<label class="radio-option"><input type="radio" name="choice" value="discordo"> Discordo</label>`;
      } else if (q.modo === 'aberta') {
          justInput.required = true;
          document.getElementById('label-justificativa').innerText = 'Sua Resposta (Obrigatória):';
          html += `<input type="hidden" name="choice" value="texto_livre">`;
      }
      inputsDiv.innerHTML = html;

      if(state.timerInterval) clearInterval(state.timerInterval);
      state.startTime = Date.now();
      document.getElementById('timer-count').innerText = "0";
      state.timerInterval = setInterval(() => { document.getElementById('timer-count').innerText = Math.floor((Date.now()-state.startTime)/1000); }, 1000);
      log('view_question', {id: q.item_id, modo: q.modo});
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

      state.currentIdx++;
      if(state.currentIdx < state.questions.length) loadQuestion(); else finishQuiz();
    });

    async function finishQuiz() {
      show('screen-end');
      document.getElementById('final-score').innerText = `${state.score} / ${state.questions.length}`;
      await fetch('IAHtextsalvar.php', { method: 'POST', body: JSON.stringify({ id_participante: state.id_participante, respostas: state.answers, logs: state.logs }) });
    }
    
    document.addEventListener("visibilitychange", () => log(document.visibilityState));
    document.addEventListener("copy", () => log('text_copied'));
