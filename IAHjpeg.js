
    // --- JAVASCRIPT (Mantido e Integrado) ---
    
    const state = { id_participante: null, codigo: '', questions: [], currentIdx: 0, answers: [], logs: [], startTime: 0, timerInterval: null, score: 0 };
    
    // Navegação
    function show(id) { document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); }
    function goRegistration() { show('screen-register'); }
    
    // Logs
    function log(type, details={}) { state.logs.push({ timestamp: Date.now(), event_type: type, details: {...details, q: state.currentIdx} }); }

    // REGISTRO (Envia os novos dados do formulário expandido)
    document.getElementById('form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true; btn.innerText = "Processando...";

      const data = { 
        idade: document.getElementById('reg-idade').value, 
        genero: document.getElementById('reg-genero').value, 
        escolaridade: document.getElementById('reg-escolaridade').value, 
        nivel_ia: document.getElementById('reg-ia').value 
      };
      
      try {
        const res = await fetch('IAHjpegregistro.php', { method: 'POST', body: JSON.stringify(data) });
        const json = await res.json();
        if (json.success) { 
          state.id_participante = json.id_participante; 
          state.codigo = json.codigo_gerado; 
          document.getElementById('user-code').innerText = state.codigo; 
          show('screen-intro'); 
        } else { alert('Erro: ' + json.error); btn.disabled = false; btn.innerText = "Tentar Novamente"; }
      } catch (err) { alert('Erro de conexão'); btn.disabled = false; btn.innerText = "Tentar Novamente"; }
    });

    // INICIAR QUIZ
    async function startQuiz() {
      try {
        const res = await fetch('IAHjpegbuscar.php');
        state.questions = await res.json();
        if(state.questions.length===0) throw new Error("Sem perguntas disponíveis no servidor.");
        log('start'); show('screen-quiz'); loadQuestion();
      } catch(e) { alert(e.message); }
    }

    // CARREGAR PERGUNTA (Lógica Dinâmica)
    function loadQuestion() {
      const q = state.questions[state.currentIdx];
      const inputsDiv = document.getElementById('dynamic-inputs');
      const justInput = document.getElementById('quiz-justificativa');
      const justLabel = document.getElementById('label-justificativa');
      const mediaDiv = document.getElementById('media-wrapper');

      // Atualiza contadores
      document.getElementById('progress-text').innerText = `Pergunta ${state.currentIdx + 1}/${state.questions.length}`;

      // 1. Texto e Mídia
      document.getElementById('quiz-question').innerText = q.texto;
      mediaDiv.className = (q.modo === 'comparativo') ? 'media-container dual' : 'media-container';
      mediaDiv.innerHTML = '';
      
      q.urls.forEach((url, i) => {
          const img = document.createElement('img');
          img.src = url;
          img.className = 'quiz-image';
          // Previne arrastar a imagem
          img.draggable = false;
          // Detecta clique na imagem
          img.onclick = () => log('image_zoomed', {url}); 
          mediaDiv.appendChild(img);
      });

      // 2. Reset Inputs
      inputsDiv.innerHTML = '';
      justInput.value = '';
      justInput.required = false;
      justLabel.innerText = 'Justificativa (Opcional):';

      // 3. Renderiza Opções
      let html = '';

      if (q.modo === 'padrao') {
          html += `<label class="radio-option"><input type="radio" name="choice" value="ia_certeza" required> É IA (Tenho Certeza)</label>`;
          html += `<label class="radio-option"><input type="radio" name="choice" value="ia_duvida"> É IA (Estou em Dúvida)</label>`;
          html += `<label class="radio-option"><input type="radio" name="choice" value="humano_certeza"> É Humano (Tenho Certeza)</label>`;
          html += `<label class="radio-option"><input type="radio" name="choice" value="humano_duvida"> É Humano (Estou em Dúvida)</label>`;
      } 
      else if (q.modo === 'comparativo') {
          html += `<label class="radio-option"><input type="radio" name="choice" value="imagem_a" required> A Imagem da Esquerda (A) é a IA</label>`;
          html += `<label class="radio-option"><input type="radio" name="choice" value="imagem_b"> A Imagem da Direita (B) é a IA</label>`;
      }
      else if (q.modo === 'analise') {
          html += `<label class="radio-option"><input type="radio" name="choice" value="concordo" required> Concordo</label>`;
          html += `<label class="radio-option"><input type="radio" name="choice" value="discordo"> Discordo</label>`;
      }
      else if (q.modo === 'aberta') {
          justInput.required = true;
          justLabel.innerText = 'Sua Resposta (Obrigatória):';
          html += `<input type="hidden" name="choice" value="texto_livre">`;
      }

      inputsDiv.innerHTML = html;

      // Timer
      if(state.timerInterval) clearInterval(state.timerInterval);
      state.startTime = Date.now();
      document.getElementById('timer-count').innerText = "0";
      state.timerInterval = setInterval(() => { document.getElementById('timer-count').innerText = Math.floor((Date.now()-state.startTime)/1000); }, 1000);
      
      log('view_question', {id: q.item_id, modo: q.modo});
    }

    // ENVIAR RESPOSTA
    document.getElementById('form-quiz').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const q = state.questions[state.currentIdx];
      const userChoice = formData.get('choice');
      
      // Correção (Lógica de Pontuação)
      let isCorrect = false;
      if (q.modo === 'padrao') isCorrect = userChoice.startsWith(q.gabarito);
      else if (q.modo === 'comparativo') isCorrect = (userChoice === q.gabarito);
      else isCorrect = true; // Modos subjetivos contam como participação

      if(isCorrect) state.score++;

      state.answers.push({
        id: q.item_id,
        pergunta: q.texto,
        choice: userChoice,
        isCorrect: isCorrect,
        timeTaken: (Date.now() - state.startTime)/1000,
        justificativa: document.getElementById('quiz-justificativa').value
      });

      state.currentIdx++;
      if(state.currentIdx < state.questions.length) loadQuestion();
      else finishQuiz();
    });

    // FINALIZAR
    async function finishQuiz() {
      show('screen-end');
      document.getElementById('final-score').innerText = `${state.score} / ${state.questions.length}`;
      
      try {
        await fetch('IAHjpegsalvar.php', { 
            method: 'POST', 
            body: JSON.stringify({ 
                id_participante: state.id_participante, 
                respostas: state.answers, 
                logs: state.logs 
            }) 
        });
      } catch (err) { console.error("Erro ao salvar:", err); }
    }
    
    // Espiões de Eventos
    document.addEventListener("visibilitychange", () => log(document.visibilityState));
    document.addEventListener("click", (e) => { if(!e.target.closest('button') && !e.target.closest('input')) log('click', {x:e.clientX, y:e.clientY}); });
