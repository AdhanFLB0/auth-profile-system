<script>
    // =================================================================
    // 1. ESTADO E VARIÁVEIS GLOBAIS
    // =================================================================
    const state = {
      id_participante: null,
      codigo: '',
      questions: [],
      currentIdx: 0,
      answers: [],
      logs: [],
      startTime: 0,
      timerInterval: null,
      score: 0
    };

    // =================================================================
    // 2. FUNÇÃO ESPIÃO (O "Cérebro" dos Logs)
    // =================================================================
    function log(type, details = {}) {
      state.logs.push({
        timestamp: Date.now(),
        event_type: type,
        details: { ...details, q: state.currentIdx }
      });
      // console.log('Spy:', type); // Descomente para debugar
    }

    // Navegação entre Telas
    function show(id) {
      document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
      document.getElementById(id).classList.remove('hidden');
    }

    function goRegistration() {
      show('screen-register');
      log('view_registration');
    }

    // =================================================================
    // 3. REGISTRO (Envia dados para o PHP)
    // =================================================================
    document.getElementById('form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.innerText = "Carregando...";

      const data = {
        idade: document.getElementById('reg-idade').value,
        genero: document.getElementById('reg-genero').value,
        escolaridade: document.getElementById('reg-escolaridade').value,
        nivel_ia: document.getElementById('reg-ia').value
      };

      try {
        const res = await fetch('IAHmp4registro.php', { method: 'POST', body: JSON.stringify(data) });
        const json = await res.json();

        if (json.success) {
          state.id_participante = json.id_participante;
          state.codigo = json.codigo_gerado;
          document.getElementById('user-code').innerText = state.codigo;
          show('screen-intro');
          log('registration_success');
        } else {
          alert('Erro: ' + json.error);
          btn.disabled = false;
        }
      } catch (err) {
        alert('Erro de conexão');
        btn.disabled = false;
      }
    });

    // =================================================================
    // 4. INICIAR QUIZ (Busca perguntas no PHP)
    // =================================================================
    async function startQuiz() {
      try {
        const res = await fetch('IAHmp4buscar.php');
        state.questions = await res.json();

        if (state.questions.length === 0) throw new Error("Sem vídeos no banco.");

        log('quiz_start');
        show('screen-quiz');
        loadQuestion();
      } catch (e) {
        alert(e.message);
      }
    }

    // Helper: Tenta extrair ID do YouTube
    function getYoutubeId(url) {
      if (!url.includes('youtube') && !url.includes('youtu.be')) return null;
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
    }

    // =================================================================
    // 5. CARREGAR PERGUNTA (LÓGICA HÍBRIDA + ESPIÃO)
    // =================================================================
    function loadQuestion() {
      const q = state.questions[state.currentIdx];
      const mediaDiv = document.getElementById('media-wrapper');
      const inputsDiv = document.getElementById('dynamic-inputs');
      const justInput = document.getElementById('quiz-justificativa');

      document.getElementById('quiz-question').innerText = q.texto;
      mediaDiv.className = (q.modo === 'comparativo') ? 'media-container dual' : 'media-container';
      mediaDiv.innerHTML = '';

      // Loop pelas URLs (pode ser 1 ou 2 vídeos)
      q.urls.forEach((url) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';

        // ESPIÃO: Detecta se o mouse está sobre o vídeo (atenção do usuário)
        wrapper.onmouseenter = () => log('video_hover_enter');
        wrapper.onmouseleave = () => log('video_hover_leave');

        const ytId = getYoutubeId(url);

        if (ytId) {
          // --- CASO 1: É YOUTUBE ---
          const iframe = document.createElement('iframe');
          iframe.src = `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`;
          iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
          iframe.allowFullscreen = true;
          wrapper.appendChild(iframe);
        } else {
          // --- CASO 2: É VÍDEO LOCAL (MP4) ---
          const video = document.createElement('video');
          video.src = url;
          video.controls = true;
          video.style.width = "100%";
          video.style.height = "100%";

          // ESPIÃO: Detecta Play/Pause em vídeo local
          video.onplay = () => log('local_video_play', { src: url });
          video.onpause = () => log('local_video_pause', { src: url });

          wrapper.appendChild(video);
        }

        mediaDiv.appendChild(wrapper);
      });

      // Reconstrói os Inputs
      inputsDiv.innerHTML = '';
      justInput.value = '';
      justInput.required = false;
      document.getElementById('label-justificativa').innerText = 'Comentário (Opcional):';

      let html = '';
      if (q.modo === 'padrao') {
        html += `<label class="radio-option"><input type="radio" name="choice" value="ia_certeza" required> É IA (Certeza)</label> <label class="radio-option"><input type="radio" name="choice" value="ia_duvida"> É IA (Dúvida)</label> <label class="radio-option"><input type="radio" name="choice" value="humano_certeza"> É Humano (Certeza)</label> <label class="radio-option"><input type="radio" name="choice" value="humano_duvida"> É Humano (Dúvida)</label>`;
      } else if (q.modo === 'comparativo') {
        html += `<label class="radio-option"><input type="radio" name="choice" value="video_a" required> A (Esq) é IA</label> <label class="radio-option"><input type="radio" name="choice" value="video_b"> B (Dir) é IA</label>`;
      } else if (q.modo === 'analise') {
        html += `<label class="radio-option"><input type="radio" name="choice" value="concordo" required> Concordo</label> <label class="radio-option"><input type="radio" name="choice" value="discordo"> Discordo</label>`;
      } else if (q.modo === 'aberta') {
        justInput.required = true;
        document.getElementById('label-justificativa').innerText = 'Sua Resposta (Obrigatória):';
        html += `<input type="hidden" name="choice" value="texto_livre">`;
      }
      inputsDiv.innerHTML = html;

      // Reinicia Timer
      if (state.timerInterval) clearInterval(state.timerInterval);
      state.startTime = Date.now();
      document.getElementById('timer-count').innerText = "0";
      state.timerInterval = setInterval(() => {
        document.getElementById('timer-count').innerText = Math.floor((Date.now() - state.startTime) / 1000);
      }, 1000);

      log('view_question', { id: q.item_id, modo: q.modo });
    }

    // =================================================================
    // 6. ENVIAR RESPOSTA
    // =================================================================
    document.getElementById('form-quiz').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const q = state.questions[state.currentIdx];
      const choice = formData.get('choice');

      // Correção
      let isCorrect = false;
      if (q.modo === 'padrao') isCorrect = choice.startsWith(q.gabarito);
      else if (q.modo === 'comparativo') isCorrect = (choice === q.gabarito);
      else isCorrect = true;

      if (isCorrect) state.score++;

      state.answers.push({
        id: q.item_id,
        pergunta: q.texto,
        choice: choice,
        isCorrect: isCorrect,
        timeTaken: (Date.now() - state.startTime) / 1000,
        justificativa: document.getElementById('quiz-justificativa').value
      });

      log('answer_submit', { correct: isCorrect });

      state.currentIdx++;
      if (state.currentIdx < state.questions.length) loadQuestion();
      else finishQuiz();
    });

    // =================================================================
    // 7. FINALIZAR E SALVAR TUDO
    // =================================================================
    async function finishQuiz() {
      show('screen-end');
      document.getElementById('final-score').innerText = `${state.score} / ${state.questions.length}`;
      log('quiz_end');

      try {
        await fetch('IAHmp4salvar.php', {
          method: 'POST',
          body: JSON.stringify({
            id_participante: state.id_participante,
            respostas: state.answers,
            logs: state.logs
          })
        });
      } catch (err) { console.error("Erro ao salvar:", err); }
    }

    // =================================================================
    // 8. ESPIÕES GLOBAIS
    // =================================================================
    // Detecta mudança de aba (o vídeo para de ser visto?)
    document.addEventListener("visibilitychange", () => {
      log(document.visibilityState === 'hidden' ? 'tab_hidden' : 'tab_visible');
    });

    // Detecta cliques na tela (mapa de calor)
    document.addEventListener("click", (e) => {
      if (!e.target.closest('button') && !e.target.closest('input')) {
        log('screen_click', { x: e.clientX, y: e.clientY });
      }
    });
  </script>
