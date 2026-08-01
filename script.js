// =====================================================
// EuroDev AI — frontend logic
// All data below comes only from what the signed-in user
// actually enters or uploads during this session. Nothing
// is pre-seeded, and nothing is faked.
// =====================================================

const state = {
  user: null, // { name, email }
  projects: [],   // { id, name, tasks: [{id, text, done}] }
  documents: [],  // { id, name, size }
  files: [],      // { id, name, size }
  agents: [],     // { id, name, task }
  chatMessages: [] // { id, text, time }
};

let idCounter = 1;
const nextId = () => idCounter++;

// ---------- View switching ----------
function showView(id){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
  document.getElementById(id).classList.add('view--active');
}

document.querySelectorAll('[data-open-auth]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    showView('view-auth');
    setAuthTab(btn.dataset.openAuth);
  });
});

document.getElementById('backToLanding').addEventListener('click', ()=> showView('view-landing'));

// ---------- Auth tabs ----------
function setAuthTab(which){
  document.querySelectorAll('.auth__tab').forEach(t=>{
    t.classList.toggle('auth__tab--active', t.dataset.authTab === which);
  });
  document.getElementById('loginForm').classList.toggle('auth__form--hidden', which !== 'login');
  document.getElementById('signupForm').classList.toggle('auth__form--hidden', which !== 'signup');
}
document.querySelectorAll('.auth__tab').forEach(tab=>{
  tab.addEventListener('click', ()=> setAuthTab(tab.dataset.authTab));
});

// ---------- Sign up ----------
document.getElementById('signupForm').addEventListener('submit', e=>{
  e.preventDefault();
  const form = e.target;
  const fullname = form.fullname.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const errorEl = document.getElementById('signupError');

  if(password.length < 6){
    errorEl.textContent = 'Password must be at least 6 characters.';
    return;
  }
  errorEl.textContent = '';
  state.user = { name: fullname, email: email };
  enterApp();
});

// ---------- Log in ----------
// No backend is connected yet, so this signs the entered email in directly
// rather than fabricating a stored-account check.
document.getElementById('loginForm').addEventListener('submit', e=>{
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const errorEl = document.getElementById('loginError');

  if(!email){
    errorEl.textContent = 'Enter your email to continue.';
    return;
  }
  errorEl.textContent = '';
  state.user = { name: email.split('@')[0], email: email };
  enterApp();
});

function enterApp(){
  document.getElementById('sidebarUserName').textContent = state.user.name;
  document.getElementById('sidebarUserEmail').textContent = state.user.email;
  document.getElementById('sidebarAvatar').textContent = state.user.name.charAt(0).toUpperCase();
  document.getElementById('dashboardGreetName').textContent = state.user.name;
  document.getElementById('settingsName').value = state.user.name;
  document.getElementById('settingsEmail').value = state.user.email;
  showView('view-app');
  renderAll();
}

document.getElementById('logoutBtn').addEventListener('click', ()=>{
  showView('view-landing');
});

// ---------- Sidebar panel switching ----------
document.querySelectorAll('[data-panel]').forEach(btn=>{
  btn.addEventListener('click', ()=> switchPanel(btn.dataset.panel));
});

function switchPanel(name){
  document.querySelectorAll('.sidebar__link').forEach(l=>{
    l.classList.toggle('sidebar__link--active', l.dataset.panel === name);
  });
  document.querySelectorAll('.panel').forEach(p=>{
    p.classList.toggle('panel--active', p.dataset.panelContent === name);
  });
}

// ---------- Helpers ----------
function formatBytes(bytes){
  if(bytes === 0) return '0 B';
  const units = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function renderAll(){
  renderDashboard();
  renderChat();
  renderCodeHistory();
  renderDocs();
  renderProjects();
  renderAgents();
  renderFiles();
}

// ---------- Dashboard ----------
function renderDashboard(){
  document.getElementById('statProjects').textContent = state.projects.length;
  const openTasks = state.projects.reduce((sum,p)=> sum + p.tasks.filter(t=>!t.done).length, 0);
  document.getElementById('statTasks').textContent = openTasks;
  document.getElementById('statFiles').textContent = state.files.length;
  document.getElementById('statDocs').textContent = state.documents.length;

  const hasAnything = state.projects.length || state.files.length || state.documents.length || state.chatMessages.length;
  document.getElementById('dashboardEmptyState').style.display = hasAnything ? 'none' : 'block';
}

// ---------- Chat ----------
document.getElementById("chatForm").addEventListener("submit", async (e)=>{

    e.preventDefault();

    const input = document.getElementById("chatInput");

    const text = input.value.trim();

    if(!text) return;

    state.chatMessages.push({
        id: nextId(),
        sender: "You",
        text,
        time: new Date()
    });

    input.value = "";

    renderChat();

    state.chatMessages.push({
        id: nextId(),
        sender: "EuroDev AI",
        text: "Thinking...",
        time: new Date()
    });

    renderChat();

    try{

        const reply = await askGemini(text);

        state.chatMessages.pop();

        state.chatMessages.push({
            id: nextId(),
            sender: "EuroDev AI",
            text: reply,
            time: new Date()
        });

    }catch(err){

        state.chatMessages.pop();

        state.chatMessages.push({
            id: nextId(),
            sender: "EuroDev AI",
            text: "❌ " + err.message,
            time: new Date()
        });

    }

    renderChat();

});

function renderChat(){
  const log = document.getElementById('chatLog');
  const empty = document.getElementById('chatEmptyState');
  log.querySelectorAll('.chat__bubble, .chat__time').forEach(el=>el.remove());
  empty.style.display = state.chatMessages.length ? 'none' : 'block';

  state.chatMessages.forEach(msg=>{
    const bubble = document.createElement('div');
    bubble.className = 'chat__bubble';
    bubble.textContent = `${msg.sender}: ${msg.text}`;
    log.appendChild(bubble);

    const time = document.createElement('span');
    time.className = 'chat__time';
    time.textContent = msg.time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    log.appendChild(time);
  });
  log.scrollTop = log.scrollHeight;
}

// ---------- Code generator ----------
// ---------- Code generator ----------

const codeRequests = [];

document.getElementById("codeForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const lang = document.getElementById("codeLang").value;
    const promptEl = document.getElementById("codePrompt");
    const prompt = promptEl.value.trim();

    if (!prompt) return;

    codeRequests.unshift({
        id: nextId(),
        lang,
        prompt,
        status: "Generating..."
    });

    promptEl.value = "";

    renderCodeHistory();

    try {

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=AQ.Ab8RN6Lh4t2iJ9sYpjKhR-cx9c4HF4AN1h7grZEfV7EgoBo_QA",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `Generate only ${lang} code.

Return only code.

Do not explain.

Task:

${prompt}`
                                }
                            ]
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        console.log(data);

        if (data.error) {
            throw new Error(data.error.message);
        }

        codeRequests[0].status =
            data.candidates?.[0]?.content?.parts?.[0]?.text ||
            "No response.";

    } catch (err) {

        codeRequests[0].status = "❌ " + err.message;

    }

    renderCodeHistory();

});

function renderCodeHistory() {

    const container = document.getElementById("codeHistory");
    const empty = document.getElementById("codeEmptyState");

    container.querySelectorAll(".code-entry").forEach(el => el.remove());

    empty.style.display = codeRequests.length ? "none" : "block";

    codeRequests.forEach(req => {

        const div = document.createElement("div");

        div.className = "code-entry";

        div.innerHTML = `
            <div class="code-entry__meta">${req.lang}</div>

            <div class="code-entry__prompt">${escapeHTML(req.prompt)}</div>

            <pre class="code-entry__status">${escapeHTML(req.status)}</pre>
        `;

        container.appendChild(div);

    });

}

// ---------- Document analysis ----------
// ---------- Document Analysis ----------

const docDropzone = document.getElementById("docDropzone");
const docInput = document.getElementById("docInput");

docDropzone.addEventListener("click", () => {
    docInput.click();
});

docInput.addEventListener("change", async () => {

    const file = docInput.files[0];
    if (!file) return;

    state.documents.push({
        id: nextId(),
        name: file.name,
        size: file.size,
        status: "Analyzing..."
    });

    renderDocs();

    try {

        const text = await file.text();

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=AQ.Ab8RN6Lh4t2iJ9sYpjKhR-cx9c4HF4AN1h7grZEfV7EgoBo_QA",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text:
`Analyze the following document.

Give:
1. Summary
2. Important Points
3. Suggestions

Document:

${text}`
                                }
                            ]
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        state.documents[state.documents.length - 1].status =
            data.candidates?.[0]?.content?.parts?.[0]?.text ||
            "No response.";

    } catch (err) {

        state.documents[state.documents.length - 1].status =
            "❌ " + err.message;

    }

    renderDocs();

    docInput.value = "";

});

function renderDocs() {

    const list = document.getElementById("docList");
    const empty = document.getElementById("docEmptyState");

    list.querySelectorAll("li:not(.empty-note)").forEach(el => el.remove());

    empty.style.display = state.documents.length ? "none" : "block";

    state.documents.forEach(doc => {

        const li = document.createElement("li");

        li.innerHTML = `
<div>
<strong>📄 ${escapeHTML(doc.name)}</strong><br>
<small>${formatBytes(doc.size)}</small>
<br><br>
<pre>${escapeHTML(doc.status || "")}</pre>
</div>

<button
class="file-list__remove"
data-remove-doc="${doc.id}">
✕
</button>
`;

        list.appendChild(li);

    });

    list.querySelectorAll("[data-remove-doc]").forEach(btn => {

        btn.onclick = () => {

            const id = Number(btn.dataset.removeDoc);

            state.documents =
                state.documents.filter(d => d.id !== id);

            renderDocs();
            renderDashboard();

        };

    });

}
// ---------- Project management ----------
document.getElementById('projectForm').addEventListener('submit', e=>{
  e.preventDefault();
  const input = document.getElementById('projectName');
  const name = input.value.trim();
  if(!name) return;
  state.projects.push({ id: nextId(), name, tasks: [] });
  input.value = '';
  renderProjects();
  renderDashboard();
});

function renderProjects(){
  const board = document.getElementById('projectBoard');
  const empty = document.getElementById('projectEmptyState');
  board.querySelectorAll('.project-card').forEach(el=>el.remove());
  empty.style.display = state.projects.length ? 'none' : 'block';

  state.projects.forEach(project=>{
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="project-card__head">
        <h4>${escapeHTML(project.name)}</h4>
        <button class="project-card__delete" data-delete-project="${project.id}">✕</button>
      </div>
      <form class="task-form" data-task-form="${project.id}">
        <input type="text" placeholder="Add a task" required>
        <button type="submit">+</button>
      </form>
      <div class="task-list" data-task-list="${project.id}"></div>
    `;
    board.appendChild(card);

    const taskList = card.querySelector(`[data-task-list="${project.id}"]`);
    project.tasks.forEach(task=>{
      const item = document.createElement('div');
      item.className = 'task-item' + (task.done ? ' done' : '');
      item.innerHTML = `
        <input type="checkbox" ${task.done ? 'checked' : ''} data-toggle-task="${task.id}">
        <span>${escapeHTML(task.text)}</span>
        <button class="task-item__remove" data-remove-task="${task.id}">✕</button>
      `;
      taskList.appendChild(item);
    });

    card.querySelector(`[data-task-form="${project.id}"]`).addEventListener('submit', e=>{
      e.preventDefault();
      const taskInput = e.target.querySelector('input');
      const text = taskInput.value.trim();
      if(!text) return;
      project.tasks.push({ id: nextId(), text, done:false });
      taskInput.value='';
      renderProjects();
      renderDashboard();
    });

    card.querySelectorAll('[data-toggle-task]').forEach(cb=>{
      cb.addEventListener('change', ()=>{
        const id = Number(cb.dataset.toggleTask);
        const task = project.tasks.find(t=>t.id===id);
        if(task) task.done = cb.checked;
        renderProjects();
        renderDashboard();
      });
    });

    card.querySelectorAll('[data-remove-task]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = Number(btn.dataset.removeTask);
        project.tasks = project.tasks.filter(t=>t.id!==id);
        renderProjects();
        renderDashboard();
      });
    });

    card.querySelector(`[data-delete-project="${project.id}"]`).addEventListener('click', ()=>{
      state.projects = state.projects.filter(p=>p.id!==project.id);
      renderProjects();
      renderDashboard();
    });
  });
}

// ---------- AI Agents ----------
// ---------- AI Agents ----------

document.getElementById("agentForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const nameInput = document.getElementById("agentName");
    const taskInput = document.getElementById("agentTask");

    const name = nameInput.value.trim();
    const task = taskInput.value.trim();

    if (!name || !task) return;

    state.agents.unshift({
        id: nextId(),
        name,
        task,
        status: "Thinking..."
    });

    renderAgents();

    try {

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=AQ.Ab8RN6Lh4t2iJ9sYpjKhR-cx9c4HF4AN1h7grZEfV7EgoBo_QA",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({

                    contents: [
                        {
                            parts: [
                                {
                                    text:

`You are an expert AI Agent.

Agent Name:
${name}

Task:
${task}

Perform this task.

Return:

Goal

Steps

Solution

Final Answer`
                                }
                            ]
                        }
                    ]

                })
            }
        );

        const data = await response.json();

        state.agents[0].status =
            data.candidates?.[0]?.content?.parts?.[0]?.text ||
            "No response.";

    }

    catch(err){

        state.agents[0].status =
            "❌ " + err.message;

    }

    renderAgents();

    nameInput.value = "";
    taskInput.value = "";

});

function renderAgents(){

    const list = document.getElementById("agentList");
    const empty = document.getElementById("agentEmptyState");

    list.querySelectorAll(".agent-card").forEach(el=>el.remove());

    empty.style.display =
        state.agents.length ? "none" : "block";

    state.agents.forEach(agent=>{

        const card = document.createElement("div");

        card.className = "agent-card";

        card.innerHTML = `
            <h4>${escapeHTML(agent.name)}</h4>

            <p><strong>Task:</strong> ${escapeHTML(agent.task)}</p>

            <pre>${escapeHTML(agent.status)}</pre>
        `;

        list.appendChild(card);

    });

}

// ---------- File storage ----------
const fileDropzone = document.getElementById('fileDropzone');
const fileInput = document.getElementById('fileInput');
const STORAGE_CAP = 1024 * 1024 * 1024; // 1GB visual scale for the meter

fileDropzone.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', ()=>{
  Array.from(fileInput.files).forEach(f=>{
    state.files.push({ id: nextId(), name: f.name, size: f.size });
  });
  fileInput.value = '';
  renderFiles();
  renderDashboard();
});

function renderFiles(){
  const list = document.getElementById('fileList');
  const empty = document.getElementById('fileEmptyState');
  list.querySelectorAll('li:not(.empty-note)').forEach(el=>el.remove());
  empty.style.display = state.files.length ? 'none' : 'block';

  const totalSize = state.files.reduce((sum,f)=>sum+f.size, 0);
  document.getElementById('storageFill').style.width = Math.min(100, (totalSize/STORAGE_CAP)*100) + '%';
  document.getElementById('storageLabel').textContent = `${formatBytes(totalSize)} used`;

  state.files.forEach(file=>{
    const li = document.createElement('li');
    li.innerHTML = `
      <span>📁 ${escapeHTML(file.name)}</span>
      <span class="file-list__meta">${formatBytes(file.size)}</span>
      <button class="file-list__remove" data-remove-file="${file.id}">✕</button>
    `;
    list.appendChild(li);
  });
  list.querySelectorAll('[data-remove-file]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = Number(btn.dataset.removeFile);
      state.files = state.files.filter(f=>f.id !== id);
      renderFiles();
      renderDashboard();
    });
  });
}

// ---------- Settings ----------
document.getElementById('settingsForm').addEventListener('submit', e=>{
  e.preventDefault();
  state.user.name = document.getElementById('settingsName').value.trim();
  state.user.email = document.getElementById('settingsEmail').value.trim();
  document.getElementById('sidebarUserName').textContent = state.user.name;
  document.getElementById('sidebarUserEmail').textContent = state.user.email;
  document.getElementById('sidebarAvatar').textContent = state.user.name.charAt(0).toUpperCase();
  document.getElementById('dashboardGreetName').textContent = state.user.name;

  const saved = document.getElementById('settingsSaved');
  saved.style.opacity = '1';
  setTimeout(()=> saved.style.opacity = '0', 1800);
});

// ---------- Utilities ----------
function escapeHTML(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
// ===============================
// Gemini API
// ===============================

const API_KEY = "AQ.Ab8RN6Lh4t2iJ9sYpjKhR-cx9c4HF4AN1h7grZEfV7EgoBo_QA";

async function askGemini(prompt){

    const response = await fetch(

        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + API_KEY,

        {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                contents: [

                    {

                        parts: [

                            {

                                text: prompt

                            }

                        ]

                    }

                ]

            })

        }

    );

    const data = await response.json();

    if (!response.ok) {

        throw new Error(

            data.error?.message || "Gemini Error"

        );

    }

    return data.candidates[0].content.parts[0].text;

}
