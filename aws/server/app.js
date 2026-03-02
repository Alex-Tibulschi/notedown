const API_BASE = "https://yd0iaumhk3.execute-api.eu-west-1.amazonaws.com/dev-test-1";

import { UserManager } from "oidc-client-ts";

const cognitoAuthConfig = {
    authority: "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_2Gj8D6Ff8",
    client_id: "329kt9djea97rjhtb9cfdenssn",
    redirect_uri: "https://d20ubwz7kz3sbz.cloudfront.net/",
    response_type: "code",
    scope: "phone openid email"
};

// create a UserManager instance
export const userManager = new UserManager({
    ...cognitoAuthConfig,
});

export async function signOutRedirect () {
  resetTokenDisplay();
  updateAuthButtons(null);
  await loadNotes(null);

  const clientId = cognitoAuthConfig.client_id;
  const logoutUri = cognitoAuthConfig.redirect_uri;
  const cognitoDomain = "https://eu-west-12gj8d6ff8.auth.eu-west-1.amazoncognito.com";
    
  window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;

  await userManager.removeUser();
};

function getElement(id) {
return typeof document !== "undefined" ? document.getElementById(id) : null;
}

function updateAuthButtons(user) {
  const signInButton = getElement("signIn");
  const signOutButton = getElement("signOut");

  const signedIn = !!user && !user.expired; // oidc-client-ts user has .expired

  if (signInButton) signInButton.style.display = signedIn ? "none" : "";
  if (signOutButton) signOutButton.style.display = signedIn ? "" : "none";
}

function updateTokenDisplay(user) {
const emailEl = document.getElementById("email");
const accessEl = document.getElementById("access-token");
const idEl = document.getElementById("id-token");
const refreshEl = document.getElementById("refresh-token");

if (emailEl) {
emailEl.textContent = user?.profile?.email ?? "(signed in but no email)";
}
if (accessEl) {
accessEl.textContent = user?.access_token ?? "";
}
if (idEl) {
idEl.textContent = user?.id_token ?? "";
}
if (refreshEl) {
refreshEl.textContent = user?.refresh_token ?? "";
}
}

function resetTokenDisplay() {
const emailEl = getElement("email");
if (emailEl) emailEl.textContent = "(not signed in)";
["access-token", "id-token", "refresh-token"].forEach((id) => {
const el = getElement(id);
if (el) el.textContent = "";
});
}

async function handleSigninCallback() {
  const params = new URLSearchParams(window.location.search);
  const isOAuthResponse = params.has("code") || params.has("state") || window.location.hash.includes("id_token=");

  if (isOAuthResponse) {
    try {
      const user = await userManager.signinRedirectCallback();
      updateTokenDisplay(user);
      window.history.replaceState({}, document.title, window.location.pathname);
      updateAuthButtons(user);
      await loadNotes(user);
      return user;
    } catch (error) {
        console.error("Cognito callback failed", error);
        resetTokenDisplay();
        updateAuthButtons(null);
        await loadNotes(null);
        return null;
    }
  }

  const existingUser = await userManager.getUser();
  if (existingUser) {
    updateTokenDisplay(existingUser);
    updateAuthButtons(existingUser);
    await loadNotes(existingUser);
    return existingUser;
  }

  resetTokenDisplay();
  updateAuthButtons(null);
  await loadNotes(null);
  return null;
}

function setupHandlers() {
  const signInButton = getElement("signIn");

  if (signInButton) {
    signInButton.addEventListener("click", () => userManager.signinRedirect());
}

const signOutButton = getElement("signOut");

if (signOutButton) {
  signOutButton.addEventListener("click", signOutRedirect);
}

const submitButton = getElement("new_note_submit");

if (submitButton) {
  submitButton.addEventListener("click", async () => {
    const user = await userManager.getUser();

    if (!user || user.expired) {
      alert("You must be signed in.");
      return;
    }

    await submitNote(user);
  });
}
}

window.addEventListener("DOMContentLoaded", async () => {
  setupHandlers();
  updateAuthButtons(null);
  loadNotes(null);
  await handleSigninCallback();
});

async function loadNotes(user) {
  //if (!user || user.expired) throw new Error("Not signed in");

  if (user != null) {
    try {

      const res = await fetch(`${API_BASE}/notes`, {
        method: "GET",
        headers: { Accept: "application/json",
          Authorization: "Bearer " + user.id_token,
        },
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

async function submitNote(user) {
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
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + user.id_token },
    body: JSON.stringify({
      title,
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


