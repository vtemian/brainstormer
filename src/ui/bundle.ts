// src/ui/bundle.ts

/**
 * Returns the bundled HTML for the brainstormer UI.
 * This is a pre-built React app embedded as a string.
 *
 * The UI connects via WebSocket and renders questions as they arrive.
 */
export function getHtmlBundle(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brainstormer</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
    .card { @apply bg-white rounded-lg shadow-md p-6 mb-4; }
  </style>
</head>
<body class="bg-gray-100 min-h-screen p-8">
  <div id="root" class="max-w-2xl mx-auto">
    <div class="text-center py-12">
      <h1 class="text-2xl font-bold text-gray-800 mb-4">Brainstormer</h1>
      <p class="text-gray-600 mb-8">Connecting to session...</p>
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
    </div>
  </div>
  
  <script>
    const wsUrl = 'ws://' + window.location.host + '/ws';
    let ws = null;
    let questions = [];
    let currentIndex = 0;
    
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
            '<div class="text-center py-12"><h1 class="text-2xl font-bold text-gray-800">Session Ended</h1><p class="text-gray-600 mt-4">You can close this window.</p></div>';
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
        root.innerHTML = '<div class="text-center py-12"><h1 class="text-2xl font-bold text-gray-800 mb-4">Brainstormer</h1><p class="text-gray-600">Waiting for questions...</p></div>';
        return;
      }
      
      const pending = questions.filter(q => !q.answered);
      const answered = questions.filter(q => q.answered);
      
      let html = '';
      
      // Show answered questions (collapsed)
      for (const q of answered) {
        html += '<div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-2 opacity-75">';
        html += '<div class="flex items-center gap-2">';
        html += '<svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
        html += '<span class="text-green-800 font-medium">' + escapeHtml(q.config.question) + '</span>';
        html += '</div></div>';
      }
      
      // Show current question
      if (pending.length > 0) {
        const q = pending[0];
        html += renderQuestion(q);
        
        // Show queue indicator
        if (pending.length > 1) {
          html += '<div class="text-center text-gray-500 text-sm mt-4">' + (pending.length - 1) + ' more question(s) in queue</div>';
        }
      }
      
      root.innerHTML = html;
      
      // Attach event listeners
      attachListeners();
    }
    
    function renderQuestion(q) {
      const config = q.config;
      let html = '<div class="bg-white rounded-lg shadow-lg p-6 mb-4">';
      html += '<h2 class="text-lg font-semibold text-gray-800 mb-4">' + escapeHtml(config.question) + '</h2>';
      
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
        default:
          html += '<p class="text-gray-600">Question type "' + q.questionType + '" not yet implemented.</p>';
          html += '<button onclick="submitAnswer(\\'' + q.id + '\\', {})" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Skip</button>';
      }
      
      html += '</div>';
      return html;
    }
    
    function renderPickOne(q) {
      const options = q.config.options || [];
      let html = '<div class="space-y-2">';
      for (const opt of options) {
        const isRecommended = q.config.recommended === opt.id;
        html += '<label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50' + (isRecommended ? ' border-blue-300 bg-blue-50' : '') + '">';
        html += '<input type="radio" name="pick_' + q.id + '" value="' + opt.id + '" class="mt-1">';
        html += '<div>';
        html += '<div class="font-medium">' + escapeHtml(opt.label) + (isRecommended ? ' <span class="text-blue-600 text-sm">(recommended)</span>' : '') + '</div>';
        if (opt.description) html += '<div class="text-sm text-gray-600">' + escapeHtml(opt.description) + '</div>';
        html += '</div></label>';
      }
      html += '</div>';
      html += '<button onclick="submitPickOne(\\'' + q.id + '\\')" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Submit</button>';
      return html;
    }
    
    function renderPickMany(q) {
      const options = q.config.options || [];
      let html = '<div class="space-y-2">';
      for (const opt of options) {
        html += '<label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">';
        html += '<input type="checkbox" name="pick_' + q.id + '" value="' + opt.id + '" class="mt-1">';
        html += '<div>';
        html += '<div class="font-medium">' + escapeHtml(opt.label) + '</div>';
        if (opt.description) html += '<div class="text-sm text-gray-600">' + escapeHtml(opt.description) + '</div>';
        html += '</div></label>';
      }
      html += '</div>';
      html += '<button onclick="submitPickMany(\\'' + q.id + '\\')" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Submit</button>';
      return html;
    }
    
    function renderConfirm(q) {
      const yesLabel = q.config.yesLabel || 'Yes';
      const noLabel = q.config.noLabel || 'No';
      let html = '';
      if (q.config.context) {
        html += '<p class="text-gray-600 mb-4">' + escapeHtml(q.config.context) + '</p>';
      }
      html += '<div class="flex gap-3">';
      html += '<button onclick="submitAnswer(\\'' + q.id + '\\', {choice: \\'yes\\'})" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">' + escapeHtml(yesLabel) + '</button>';
      html += '<button onclick="submitAnswer(\\'' + q.id + '\\', {choice: \\'no\\'})" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">' + escapeHtml(noLabel) + '</button>';
      if (q.config.allowCancel) {
        html += '<button onclick="submitAnswer(\\'' + q.id + '\\', {choice: \\'cancel\\'})" class="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">Cancel</button>';
      }
      html += '</div>';
      return html;
    }
    
    function renderAskText(q) {
      const multiline = q.config.multiline;
      let html = '';
      if (q.config.context) {
        html += '<p class="text-gray-600 mb-4">' + escapeHtml(q.config.context) + '</p>';
      }
      if (multiline) {
        html += '<textarea id="text_' + q.id + '" class="w-full p-3 border rounded-lg" rows="4" placeholder="' + escapeHtml(q.config.placeholder || '') + '"></textarea>';
      } else {
        html += '<input type="text" id="text_' + q.id + '" class="w-full p-3 border rounded-lg" placeholder="' + escapeHtml(q.config.placeholder || '') + '">';
      }
      html += '<button onclick="submitText(\\'' + q.id + '\\')" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Submit</button>';
      return html;
    }
    
    function renderThumbs(q) {
      let html = '';
      if (q.config.context) {
        html += '<p class="text-gray-600 mb-4">' + escapeHtml(q.config.context) + '</p>';
      }
      html += '<div class="flex gap-4">';
      html += '<button onclick="submitAnswer(\\'' + q.id + '\\', {choice: \\'up\\'})" class="p-4 text-4xl hover:bg-green-100 rounded-lg">\\uD83D\\uDC4D</button>';
      html += '<button onclick="submitAnswer(\\'' + q.id + '\\', {choice: \\'down\\'})" class="p-4 text-4xl hover:bg-red-100 rounded-lg">\\uD83D\\uDC4E</button>';
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
        html += '<p class="text-gray-600 mb-4">' + escapeHtml(q.config.context) + '</p>';
      }
      html += '<div class="flex items-center gap-4">';
      html += '<span class="text-gray-600">' + min + '</span>';
      html += '<input type="range" id="slider_' + q.id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + defaultVal + '" class="flex-1">';
      html += '<span class="text-gray-600">' + max + '</span>';
      html += '<span id="slider_val_' + q.id + '" class="font-bold text-blue-600 w-12 text-center">' + defaultVal + '</span>';
      html += '</div>';
      html += '<button onclick="submitSlider(\\'' + q.id + '\\')" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Submit</button>';
      return html;
    }
    
    function attachListeners() {
      // Attach slider value display
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
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Start connection
    connect();
  </script>
</body>
</html>`;
}
