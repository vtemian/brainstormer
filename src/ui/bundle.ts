// src/ui/bundle.ts

/**
 * Returns the bundled HTML for the brainstormer UI.
 * Uses nof1 design system - IBM Plex Mono, terminal aesthetic.
 */
export function getHtmlBundle(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brainstormer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --background: #ffffff;
      --surface: #ffffff;
      --surface-elevated: #f8f9fa;
      --surface-hover: #f1f3f4;
      --foreground: #000000;
      --foreground-muted: #333333;
      --foreground-subtle: #666666;
      --border: #000000;
      --border-subtle: #cccccc;
      --accent-success: #00aa00;
      --accent-error: #ff0000;
    }

    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      height: 100%;
      background: var(--background);
      color: var(--foreground);
      font-family: 'IBM Plex Mono', monospace;
      font-size: 14px;
      line-height: 1.5;
      letter-spacing: -0.02em;
    }

    body {
      position: relative;
    }

    body::before {
      content: "";
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E");
      background-size: 180px 180px;
      pointer-events: none;
      z-index: 1;
    }

    #root {
      position: relative;
      z-index: 2;
      max-width: 640px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      min-height: 100vh;
    }

    h1, h2, h3 {
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .header {
      text-align: center;
      padding: 3rem 0;
    }

    .header h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .header p {
      color: var(--foreground-subtle);
      font-size: 0.875rem;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--border-subtle);
      border-top-color: var(--foreground);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 1.5rem auto 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 1.5rem;
      margin-bottom: 1rem;
    }

    .card-answered {
      background: var(--surface-elevated);
      border-color: var(--border-subtle);
      opacity: 0.7;
      padding: 1rem;
    }

    .card-answered .check {
      color: var(--accent-success);
      margin-right: 0.5rem;
    }

    .question-text {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1.25rem;
      line-height: 1.4;
    }

    .context {
      color: var(--foreground-muted);
      font-size: 0.875rem;
      margin-bottom: 1rem;
      padding-left: 1rem;
      border-left: 2px solid var(--border-subtle);
    }

    .options {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .option {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem;
      border: 1px solid var(--border-subtle);
      cursor: pointer;
      transition: none;
    }

    .option:hover {
      background: var(--surface-hover);
      border-color: var(--border);
    }

    .option.recommended {
      border-color: var(--border);
      background: var(--surface-elevated);
    }

    .option input {
      margin-top: 0.125rem;
      accent-color: var(--foreground);
    }

    .option-content {
      flex: 1;
    }

    .option-label {
      font-weight: 500;
    }

    .option-desc {
      font-size: 0.8125rem;
      color: var(--foreground-subtle);
      margin-top: 0.25rem;
    }

    .option-tag {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--foreground-muted);
      margin-left: 0.5rem;
    }

    .btn {
      display: inline-block;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--foreground);
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 500;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.5rem 1rem;
      cursor: pointer;
      transition: none;
    }

    .btn:hover {
      background: var(--surface-hover);
    }

    .btn:active {
      background: var(--foreground);
      color: var(--background);
    }

    .btn-primary {
      background: var(--foreground);
      color: var(--background);
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .btn-success {
      border-color: var(--accent-success);
      color: var(--accent-success);
    }

    .btn-success:hover {
      background: var(--accent-success);
      color: var(--background);
    }

    .btn-danger {
      border-color: var(--accent-error);
      color: var(--accent-error);
    }

    .btn-danger:hover {
      background: var(--accent-error);
      color: var(--background);
    }

    .btn-group {
      display: flex;
      gap: 0.5rem;
      margin-top: 1.25rem;
    }

    .input, .textarea {
      width: 100%;
      padding: 0.75rem;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--foreground);
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.875rem;
    }

    .input:focus, .textarea:focus {
      outline: none;
      border-color: var(--foreground);
    }

    .textarea {
      resize: vertical;
      min-height: 100px;
    }

    .slider-container {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .slider-container input[type="range"] {
      flex: 1;
      height: 2px;
      background: var(--border-subtle);
      appearance: none;
      -webkit-appearance: none;
    }

    .slider-container input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      background: var(--foreground);
      cursor: pointer;
    }

    .slider-value {
      font-weight: 600;
      min-width: 3rem;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .slider-labels {
      color: var(--foreground-subtle);
      font-size: 0.75rem;
    }

    .thumbs-container {
      display: flex;
      gap: 1rem;
    }

    .thumb-btn {
      font-size: 2rem;
      padding: 1rem 1.5rem;
      border: 1px solid var(--border-subtle);
      background: var(--surface);
      cursor: pointer;
    }

    .thumb-btn:hover {
      border-color: var(--border);
      background: var(--surface-hover);
    }

    .queue-indicator {
      text-align: center;
      color: var(--foreground-subtle);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 1rem;
    }

    .thinking {
      text-align: center;
      padding: 2rem;
      margin-top: 1rem;
      border: 1px dashed var(--border-subtle);
    }

    .thinking-text {
      color: var(--foreground-subtle);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }

    .thinking .spinner {
      margin: 0 auto;
    }

    .review-content {
      background: var(--surface-elevated);
      border: 1px solid var(--border-subtle);
      padding: 1rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      line-height: 1.6;
      white-space: pre-wrap;
      max-height: 400px;
      overflow-y: auto;
    }

    .feedback-input {
      margin-top: 1rem;
    }

    .feedback-input label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--foreground-subtle);
      margin-bottom: 0.5rem;
    }

    .session-ended {
      text-align: center;
      padding: 4rem 0;
    }

    .session-ended h1 {
      margin-bottom: 0.5rem;
    }

    .session-ended p {
      color: var(--foreground-subtle);
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="header">
      <h1>Brainstormer</h1>
      <p>Connecting to session...</p>
      <div class="spinner"></div>
    </div>
  </div>
  
  <script>
    const wsUrl = 'ws://' + window.location.host + '/ws';
    let ws = null;
    let questions = [];
    
    function connect() {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('Connected to brainstormer');
        ws.send(JSON.stringify({ type: 'connected' }));
        render();
      };
      
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log('Received:', msg);
        
        if (msg.type === 'question') {
          questions.push(msg);
          render();
        } else if (msg.type === 'cancel') {
          questions = questions.filter(q => q.id !== msg.id);
          render();
        } else if (msg.type === 'end') {
          document.getElementById('root').innerHTML = 
            '<div class="session-ended"><h1>Session Ended</h1><p>You can close this window.</p></div>';
        }
      };
      
      ws.onclose = () => {
        console.log('Disconnected, reconnecting in 2s...');
        setTimeout(connect, 2000);
      };
    }
    
    function render() {
      const root = document.getElementById('root');
      
      if (questions.length === 0) {
        root.innerHTML = '<div class="header"><h1>Brainstormer</h1><p>Waiting for questions...</p></div>';
        return;
      }
      
      const pending = questions.filter(q => !q.answered);
      const answered = questions.filter(q => q.answered);
      
      let html = '';
      
      // Show answered questions (collapsed)
      for (const q of answered) {
        html += '<div class="card card-answered">';
        html += '<span class="check">[OK]</span>';
        html += '<span>' + escapeHtml(q.config.question) + '</span>';
        html += '</div>';
      }
      
      // Show current question
      if (pending.length > 0) {
        const q = pending[0];
        html += renderQuestion(q);
        
        // Show queue indicator
        if (pending.length > 1) {
          html += '<div class="queue-indicator">' + (pending.length - 1) + ' more question(s) in queue</div>';
        }
      } else if (answered.length > 0) {
        // All answered, waiting for more questions
        html += '<div class="thinking">';
        html += '<div class="thinking-text">Thinking...</div>';
        html += '<div class="spinner"></div>';
        html += '</div>';
      }
      
      root.innerHTML = html;
      attachListeners();
    }
    
    function renderQuestion(q) {
      const config = q.config;
      let html = '<div class="card">';
      html += '<div class="question-text">' + escapeHtml(config.question) + '</div>';
      
      switch (q.questionType) {
        case 'pick_one':
          html += renderPickOne(q);
          break;
        case 'pick_many':
          html += renderPickMany(q);
          break;
        case 'confirm':
          html += renderConfirm(q);
          break;
        case 'ask_text':
          html += renderAskText(q);
          break;
        case 'thumbs':
          html += renderThumbs(q);
          break;
        case 'slider':
          html += renderSlider(q);
          break;
        case 'review_section':
          html += renderReviewSection(q);
          break;
        default:
          html += '<p>Question type "' + q.questionType + '" not yet implemented.</p>';
          html += '<div class="btn-group"><button onclick="submitAnswer(\\'' + q.id + '\\', {})" class="btn">Skip</button></div>';
      }
      
      html += '</div>';
      return html;
    }
    
    function renderPickOne(q) {
      const options = q.config.options || [];
      let html = '<div class="options">';
      for (const opt of options) {
        const isRecommended = q.config.recommended === opt.id;
        html += '<label class="option' + (isRecommended ? ' recommended' : '') + '">';
        html += '<input type="radio" name="pick_' + q.id + '" value="' + opt.id + '">';
        html += '<div class="option-content">';
        html += '<div class="option-label">' + escapeHtml(opt.label);
        if (isRecommended) html += '<span class="option-tag">(recommended)</span>';
        html += '</div>';
        if (opt.description) html += '<div class="option-desc">' + escapeHtml(opt.description) + '</div>';
        html += '</div></label>';
      }
      html += '</div>';
      html += '<div class="btn-group"><button onclick="submitPickOne(\\'' + q.id + '\\')" class="btn btn-primary">Submit</button></div>';
      return html;
    }
    
    function renderPickMany(q) {
      const options = q.config.options || [];
      let html = '<div class="options">';
      for (const opt of options) {
        html += '<label class="option">';
        html += '<input type="checkbox" name="pick_' + q.id + '" value="' + opt.id + '">';
        html += '<div class="option-content">';
        html += '<div class="option-label">' + escapeHtml(opt.label) + '</div>';
        if (opt.description) html += '<div class="option-desc">' + escapeHtml(opt.description) + '</div>';
        html += '</div></label>';
      }
      html += '</div>';
      html += '<div class="btn-group"><button onclick="submitPickMany(\\'' + q.id + '\\')" class="btn btn-primary">Submit</button></div>';
      return html;
    }
    
    function renderConfirm(q) {
      const yesLabel = q.config.yesLabel || 'Yes';
      const noLabel = q.config.noLabel || 'No';
      let html = '';
      if (q.config.context) {
        html += '<div class="context">' + escapeHtml(q.config.context) + '</div>';
      }
      html += '<div class="btn-group">';
      html += '<button onclick="submitAnswer(\\'' + q.id + '\\', {choice: \\'yes\\'})" class="btn btn-success">' + escapeHtml(yesLabel) + '</button>';
      html += '<button onclick="submitAnswer(\\'' + q.id + '\\', {choice: \\'no\\'})" class="btn btn-danger">' + escapeHtml(noLabel) + '</button>';
      if (q.config.allowCancel) {
        html += '<button onclick="submitAnswer(\\'' + q.id + '\\', {choice: \\'cancel\\'})" class="btn">Cancel</button>';
      }
      html += '</div>';
      return html;
    }
    
    function renderAskText(q) {
      const multiline = q.config.multiline;
      let html = '';
      if (q.config.context) {
        html += '<div class="context">' + escapeHtml(q.config.context) + '</div>';
      }
      if (multiline) {
        html += '<textarea id="text_' + q.id + '" class="textarea" rows="4" placeholder="' + escapeHtml(q.config.placeholder || '') + '"></textarea>';
      } else {
        html += '<input type="text" id="text_' + q.id + '" class="input" placeholder="' + escapeHtml(q.config.placeholder || '') + '">';
      }
      html += '<div class="btn-group"><button onclick="submitText(\\'' + q.id + '\\')" class="btn btn-primary">Submit</button></div>';
      return html;
    }
    
    function renderThumbs(q) {
      let html = '';
      if (q.config.context) {
        html += '<div class="context">' + escapeHtml(q.config.context) + '</div>';
      }
      html += '<div class="thumbs-container">';
      html += '<button onclick="submitAnswer(\\'' + q.id + '\\', {choice: \\'up\\'})" class="thumb-btn">\\uD83D\\uDC4D</button>';
      html += '<button onclick="submitAnswer(\\'' + q.id + '\\', {choice: \\'down\\'})" class="thumb-btn">\\uD83D\\uDC4E</button>';
      html += '</div>';
      return html;
    }
    
    function renderSlider(q) {
      const min = q.config.min;
      const max = q.config.max;
      const step = q.config.step || 1;
      const defaultVal = q.config.defaultValue || Math.floor((min + max) / 2);
      let html = '';
      if (q.config.context) {
        html += '<div class="context">' + escapeHtml(q.config.context) + '</div>';
      }
      html += '<div class="slider-container">';
      html += '<span class="slider-labels">' + min + '</span>';
      html += '<input type="range" id="slider_' + q.id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + defaultVal + '">';
      html += '<span class="slider-labels">' + max + '</span>';
      html += '<span id="slider_val_' + q.id + '" class="slider-value">' + defaultVal + '</span>';
      html += '</div>';
      html += '<div class="btn-group"><button onclick="submitSlider(\\'' + q.id + '\\')" class="btn btn-primary">Submit</button></div>';
      return html;
    }
    
    function renderReviewSection(q) {
      let html = '';
      if (q.config.context) {
        html += '<div class="context">' + escapeHtml(q.config.context) + '</div>';
      }
      html += '<div class="review-content">' + escapeHtml(q.config.content || '') + '</div>';
      html += '<div class="feedback-input">';
      html += '<label for="feedback_' + q.id + '">Feedback (optional)</label>';
      html += '<textarea id="feedback_' + q.id + '" class="textarea" rows="3" placeholder="Any suggestions or changes..."></textarea>';
      html += '</div>';
      html += '<div class="btn-group">';
      html += '<button onclick="submitReview(\\'' + q.id + '\\', \\'approve\\')" class="btn btn-success">Approve</button>';
      html += '<button onclick="submitReview(\\'' + q.id + '\\', \\'revise\\')" class="btn btn-danger">Needs Revision</button>';
      html += '</div>';
      return html;
    }
    
    function attachListeners() {
      document.querySelectorAll('input[type="range"]').forEach(slider => {
        const id = slider.id.replace('slider_', 'slider_val_');
        slider.oninput = () => {
          document.getElementById(id).textContent = slider.value;
        };
      });
    }
    
    function submitAnswer(questionId, answer) {
      const q = questions.find(q => q.id === questionId);
      if (q) {
        q.answered = true;
        ws.send(JSON.stringify({ type: 'response', id: questionId, answer }));
        render();
      }
    }
    
    function submitPickOne(questionId) {
      const selected = document.querySelector('input[name="pick_' + questionId + '"]:checked');
      if (selected) {
        submitAnswer(questionId, { selected: selected.value });
      }
    }
    
    function submitPickMany(questionId) {
      const selected = Array.from(document.querySelectorAll('input[name="pick_' + questionId + '"]:checked')).map(el => el.value);
      submitAnswer(questionId, { selected });
    }
    
    function submitText(questionId) {
      const input = document.getElementById('text_' + questionId);
      if (input) {
        submitAnswer(questionId, { text: input.value });
      }
    }
    
    function submitSlider(questionId) {
      const slider = document.getElementById('slider_' + questionId);
      if (slider) {
        submitAnswer(questionId, { value: parseFloat(slider.value) });
      }
    }
    
    function submitReview(questionId, decision) {
      const feedbackEl = document.getElementById('feedback_' + questionId);
      const feedback = feedbackEl ? feedbackEl.value : '';
      submitAnswer(questionId, { decision, feedback: feedback || undefined });
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    connect();
  </script>
</body>
</html>`;
}
