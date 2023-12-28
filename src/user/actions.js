const BASE_URL = "http://localhost:3000";

async function handleSignIn(e) {
  e.preventDefault();
  const formData = new FormData(form);
  const session = await fetchSession(formData.get("email"));
  try {
    const hashedPassword = await hash(`${formData.get("password")}`);
    const hashedData = await hash(`${hashedPassword}${session}`);

    const resp = await fetch(`${BASE_URL}/signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        session: session,
      },
      body: JSON.stringify({
        email: formData.get("email"),
        data: hashedData,
      }),
    });
    const msg = (await resp.json()).msg;
    alert(msg);
    if (msg.includes("成功")) {
      window.location.href = "/src/user/homepage.html";
    }
  } catch (error) {
    console.error(error);
  }
}

async function fetchSession(email) {
  try {
    const sessionResp = await fetch(`${BASE_URL}/session?email=${email}`, {
      method: "GET",
    });
    const session = (await sessionResp.json()).token;
    return session;
  } catch (error) {
    console.error(error);
  }
  return null;
}

const form = document.getElementById("form");
form?.addEventListener("submit", handleSignIn);

const modifyForm = document.getElementById("modify-form");
modifyForm?.addEventListener("submit", handleModify);

// 修改密码
async function handleModify(e) {
  e.preventDefault();
  const formData = new FormData(modifyForm);
  const [session, publicKeyJwk] = await Promise.all([
    fetchSession(formData.get("email")),
    fetchPublicKey(),
  ]);
  console.log(session, publicKeyJwk);
  const publicKey = await window.crypto.subtle.importKey(
    "jwk",
    publicKeyJwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-1",
    },
    false,
    ["encrypt"]
  );
  const newPassword = formData.get("newPassword");
  const encryptedPasswordArray = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    new TextEncoder().encode(newPassword)
  );
  const encryptedPassword = btoa(
    String.fromCharCode(...new Uint8Array(encryptedPasswordArray))
  );
  const hashedPassword = await hash(formData.get("password"));
  const hashedData = await hash(`${hashedPassword}${session}`);
  try {
    const resp = await axios.put(`${BASE_URL}/updatePassword`, {
      email: formData.get("email"),
      data: hashedData,
      encryptedPassword,
      publicKeyJwk,
    });
    const { msg } = resp.data;
    alert(msg);
  } catch (error) {
    console.error(error);
    alert("更新失败!");
  }
}

async function fetchPublicKey() {
  try {
    const resp = await axios.get(`${BASE_URL}/publicKey`);
    const { publicKey } = resp.data;
    return publicKey;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function hash(string) {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest("SHA-256", utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((bytes) => bytes.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}
