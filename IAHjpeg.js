<script>
    const state = { id_participante: null, codigo: '', questions: [], currentIdx: 0, answers: [], logs: [], startTime: 0, timerInterval: null, score: 0 };
    
    function show(id) { document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); }
    function goRegistration() { show('screen-register'); log('view_registration'); }
    function log(type, details={}) { state.logs.push({ timestamp: Date.now(), event_type: type, details: {...details, q: state.currentIdx} }); }

    // REGISTRO
    document.getElementById('form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled = true; btn.innerText = "Processando...";
      const data = { idade: document.getElementById('reg-idade').value, genero: document.getElementById('reg-genero').value, escolaridade: document.getElementById('reg-escolaridade').value, nivel_ia: document.getElementById('reg-ia').value };
      try {
        const res = await fetch('IAHjpegregistro.php', { method: 'POST', body: JSON.stringify(data) });
        const json = await res.json();
        if (json.success) { state.id_participante = json.id_participante; state.codigo = json.codigo_gerado; document.getElementById('user-code').innerText = state.codigo; show('screen-intro'); log('registration_success'); }
        else { alert(json.error); btn.disabled = false; }
      } catch (err) { alert('Erro conexão'); btn.disabled = false; }
    });

    // INICIAR
    async function startQuiz() {
      try {
        const res = await fetch('IAHjpegbuscar.php');
        state.questions = await res.json();
        if(state.questions.length===0) throw new Error("Sem perguntas.");
        log('quiz_start'); show('screen-quiz'); loadQuestion();
      } catch(e) { alert(e.message); }
    }

    // CARREGAR PERGUNTA
    function loadQuestion() {
      const q = state.questions[state.currentIdx];
      const mediaDiv = document.getElementById('media-wrapper');
      const inputsDiv = document.getElementById('dynamic-inputs');
      const justInput = document.getElementById('quiz-justificativa');

      document.getElementById('quiz-question').innerText = q.texto;
      mediaDiv.className = (q.modo === 'comparativo') ? 'media-container dual' : 'media-container';
      mediaDiv.innerHTML = '';
      
      q.urls.forEach((url) => {
          const img = document.createElement('img');
          img.src = url; img.className = 'quiz-image';
          img.onmousedown = () => log('image_click', { url });
          mediaDiv.appendChild(img);
      });

      // --- CRIAÇÃO DOS NOVOS INPUTS (SEPARADOS) ---
      inputsDiv.innerHTML = ''; 
      justInput.value = ''; justInput.required = false;
      let html = '';

      // 1. DECISÃO PRINCIPAL (Radio Buttons)
      if (q.modo === 'padrao') {
          html += `<div style="display:flex; gap:10px; justify-content:center;">
                    <label class="radio-option" style="width:45%; justify-content:center;"><input type="radio" name="main_decision" value="ia" required> <strong>É IA</strong></label>
                    <label class="radio-option" style="width:45%; justify-content:center;"><input type="radio" name="main_decision" value="humano"> <strong>É Humano</strong></label>
                   </div>`;
      } 
      else if (q.modo === 'comparativo') {
          html += `<div style="display:flex; gap:10px; justify-content:center;">
                    <label class="radio-option" style="width:45%"><input type="radio" name="main_decision" value="imagem_a" required> Imagem A é IA</label>
                    <label class="radio-option" style="width:45%"><input type="radio" name="main_decision" value="imagem_b"> Imagem B é IA</label>
                   </div>`;
      }
      else if (q.modo === 'analise') {
          html += `<div style="display:flex; gap:10px; justify-content:center;">
                    <label class="radio-option"><input type="radio" name="main_decision" value="concordo" required> Concordo</label>
                    <label class="radio-option"><input type="radio" name="main_decision" value="discordo"> Discordo</label>
                   </div>`;
      }

      // 2. GRAU DE CONFIANÇA (Para todos os modos, exceto aberta)
      if (q.modo !== 'aberta') {
          html += `<div class="confidence-box">
                      <label style="margin-bottom:10px; display:block;">Grau de Confiança (1 a 5): <span id="conf-val" style="font-weight:bold; color:#b21f1f; font-size:1.2em;">3</span></label>
                      <div style="display:flex; align-items:center; justify-content:space-between; color:#666; font-size:12px;">
                        <span>(Chute)</span>
                        <input type="range" id="confidence-input" name="confidence" min="1" max="5" value="3" oninput="document.getElementById('conf-val').innerText = this.value">
                        <span>(Certeza)</span>
                      </div>
                   </div>`;
      } else {
          // Se for aberta, input hidden para não quebrar
          html += `<input type="hidden" name="main_decision" value="texto_livre"><input type="hidden" name="confidence" value="0">`;
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
      
      const mainChoice = formData.get('main_decision');
      const confidence = formData.get('confidence');
      
      // O PULO DO GATO: Junta a decisão com a confiança para salvar no banco
      // Ex: "ia_confianca_5" ou "humano_confianca_1"
      const finalChoiceString = (q.modo === 'aberta') ? 'texto_livre' : `${mainChoice}_confianca_${confidence}`;

      // Correção
      let isCorrect = false;
      if (q.modo === 'padrao') isCorrect = (mainChoice === q.gabarito);
      else if (q.modo === 'comparativo') isCorrect = (mainChoice === q.gabarito);
      else isCorrect = true;

      if(isCorrect) state.score++;

      state.answers.push({
        id: q.item_id, pergunta: q.texto, 
        choice: finalChoiceString, // Salva o formato combinado
        isCorrect: isCorrect,
        timeTaken: (Date.now() - state.startTime)/1000,
        justificativa: document.getElementById('quiz-justificativa').value
      });

      log('answer_submit', { choice: mainChoice, confidence: confidence });
      
      state.currentIdx++;
      if(state.currentIdx < state.questions.length) loadQuestion(); else finishQuiz();
    });

    async function finishQuiz() {
      show('screen-end');
      document.getElementById('final-score').innerText = `${state.score} / ${state.questions.length}`;
      try {
        await fetch('IAHjpegsalvar.php', { method: 'POST', body: JSON.stringify({ id_participante: state.id_participante, respostas: state.answers, logs: state.logs }) });
      } catch (err) { console.error("Erro ao salvar:", err); }
    }
    
    document.addEventListener("visibilitychange", () => log(document.visibilityState));
    document.addEventListener("click", (e) => { if(!e.target.closest('button')) log('screen_click', {x:e.clientX, y:e.clientY}); });
</script>
