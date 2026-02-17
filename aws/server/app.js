const API_BASE = "https://yd0iaumhk3.execute-api.eu-west-1.amazonaws.com/dev-test-1";

async function loadNotes() {
  try {
    const res = await fetch(`${API_BASE}/notes`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json(); // expected: { notes: [...] }

    const notesDiv = document.getElementById("notes");
    notesDiv.innerHTML = "";

    (data.notes || []).forEach((note) => {
      const card = document.createElement("div");

      const title = note.title ?? "(untitled)";
      const creator = note.user_id ?? "(unknown)";
      const updatedAt = note.updated_at
        ? new Date(note.updated_at * 1000).toLocaleString()
        : "";

      // content is an object (JSON) now, so stringify it for display
      const contentText = note.content ? JSON.stringify(note.content, null, 2) : "";

      card.innerHTML = `
        <h3>${escapeHtml(title)}</h3>
        <p><strong>Creator:</strong> ${escapeHtml(creator)}</p>
        <p><strong>Updated:</strong> ${escapeHtml(updatedAt)}</p>
        <pre>${escapeHtml(contentText)}</pre>
        <hr/>
      `;

      notesDiv.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load notes:", err);
  }
}

// Tiny safety helper so user-entered text can't inject HTML
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[c]));
}

// call on page load
window.addEventListener("DOMContentLoaded", loadNotes);

async function submitNote() {
  const title = document.querySelector("#new_note_title").value;
  const contentText = document.querySelector("#new_note_text").value;

  // If the textarea is JSON, parse it; otherwise store as plain text
  let content;
  try {
    content = JSON.parse(contentText);
  } catch {
    content = { text: contentText };
  }

  const response = await fetch(`${API_BASE}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      user_id: "alex",
      content,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  console.log("Created note:", data.note_id);
}

document.querySelector("#new_note_submit").addEventListener("click", submitNote);