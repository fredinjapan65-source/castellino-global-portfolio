document.addEventListener("DOMContentLoaded", () => {
  const unlockBtn = document.getElementById("unlockVaultBtn");
  const lockBtn = document.getElementById("lockVaultBtn");
  const downloadBtn = document.getElementById("downloadPdfBtn");
  const passwordInput = document.getElementById("vaultPassword");
  const vaultError = document.getElementById("vaultError");
  const vaultContent = document.getElementById("vaultContent");
  const passwordPrompt = document.getElementById("passwordPrompt");
  const vaultPdfFrame = document.getElementById("vaultPdfFrame");
  const vaultLoading = document.getElementById("vaultLoading");

  const ENCRYPTED_FILE_PATH = "assets/secure/login_credentials.pdf.enc";

  const HEADER = "RICARDO_VAULT_V1";
  const PBKDF2_ITERATIONS = 200000;
  const KEY_SIZE_WORDS = 256 / 32; // 8 words = 256 bits
  const SALT_SIZE = 16;
  const IV_SIZE = 16;

  let currentPdfBlob = null;
  let currentPdfUrl = null;

  function showError(message) {
    vaultError.textContent = message || "";
  }

  function setLoading(isLoading) {
    vaultLoading.classList.toggle("hidden", !isLoading);
  }

  function cleanupBlobUrl() {
    if (currentPdfUrl) {
      URL.revokeObjectURL(currentPdfUrl);
      currentPdfUrl = null;
    }
    currentPdfBlob = null;
  }

  async function fetchEncryptedText() {
    const response = await fetch(ENCRYPTED_FILE_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Encrypted credentials file could not be loaded.");
    }
    return await response.text();
  }

  function wordArrayToUint8Array(wordArray) {
    const { words, sigBytes } = wordArray;
    const u8 = new Uint8Array(sigBytes);
    let offset = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const bytes = [
        (word >> 24) & 0xff,
        (word >> 16) & 0xff,
        (word >> 8) & 0xff,
        word & 0xff
      ];

      for (let b = 0; b < 4 && offset < sigBytes; b++) {
        u8[offset++] = bytes[b];
      }
    }

    return u8;
  }

  function uint8ArrayToWordArray(u8Array) {
    const words = [];
    for (let i = 0; i < u8Array.length; i++) {
      words[(i / 4) | 0] |= u8Array[i] << (24 - 8 * (i % 4));
    }
    return CryptoJS.lib.WordArray.create(words, u8Array.length);
  }

  function decryptPayloadToPdfBlob(base64Payload, password) {
    try {
      const binary = atob(base64Payload.trim());
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const headerBytes = new TextEncoder().encode(HEADER);
      if (bytes.length < headerBytes.length + SALT_SIZE + IV_SIZE + 1) {
        throw new Error("Encrypted file is invalid.");
      }

      for (let i = 0; i < headerBytes.length; i++) {
        if (bytes[i] !== headerBytes[i]) {
          throw new Error("Encrypted file header is invalid.");
        }
      }

      const saltStart = headerBytes.length;
      const ivStart = saltStart + SALT_SIZE;
      const cipherStart = ivStart + IV_SIZE;

      const salt = bytes.slice(saltStart, ivStart);
      const iv = bytes.slice(ivStart, cipherStart);
      const ciphertext = bytes.slice(cipherStart);

      const saltWA = uint8ArrayToWordArray(salt);
      const ivWA = uint8ArrayToWordArray(iv);
      const cipherWA = uint8ArrayToWordArray(ciphertext);

      const key = CryptoJS.PBKDF2(password, saltWA, {
        keySize: KEY_SIZE_WORDS,
        iterations: PBKDF2_ITERATIONS,
        hasher: CryptoJS.algo.SHA1
      });

      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: cipherWA },
        key,
        {
          iv: ivWA,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }
      );

      if (!decrypted.sigBytes || decrypted.sigBytes <= 0) {
        throw new Error("Incorrect password or corrupted file.");
      }

      const pdfBytes = wordArrayToUint8Array(decrypted);

      // Verify PDF header "%PDF"
      if (
        pdfBytes.length < 4 ||
        pdfBytes[0] !== 0x25 ||
        pdfBytes[1] !== 0x50 ||
        pdfBytes[2] !== 0x44 ||
        pdfBytes[3] !== 0x46
      ) {
        throw new Error("Incorrect password or invalid decrypted PDF.");
      }

      return new Blob([pdfBytes], { type: "application/pdf" });
    } catch {
      throw new Error("Incorrect password or invalid encrypted file.");
    }
  }

  async function unlockVault() {
    const password = passwordInput.value.trim();
    showError("");

    if (!password) {
      showError("Please enter the vault password.");
      passwordInput.focus();
      return;
    }

    try {
      setLoading(true);
      cleanupBlobUrl();

      const encryptedText = await fetchEncryptedText();
      const pdfBlob = decryptPayloadToPdfBlob(encryptedText, password);

      currentPdfBlob = pdfBlob;
      currentPdfUrl = URL.createObjectURL(pdfBlob);

      vaultPdfFrame.src = currentPdfUrl;
      passwordPrompt.classList.add("hidden");
      vaultContent.classList.remove("hidden");
    } catch (err) {
      showError(err.message || "Unable to unlock vault.");
      passwordInput.value = "";
      passwordInput.focus();
    } finally {
      setLoading(false);
    }
  }

  function lockVault() {
    vaultContent.classList.add("hidden");
    passwordPrompt.classList.remove("hidden");
    passwordInput.value = "";
    showError("");
    vaultPdfFrame.src = "";
    cleanupBlobUrl();
  }

  function downloadDecryptedPdf() {
    if (!currentPdfBlob) return;

    const downloadUrl = URL.createObjectURL(currentPdfBlob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "login_credentials.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  unlockBtn.addEventListener("click", unlockVault);

  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") unlockVault();
  });

  if (lockBtn) lockBtn.addEventListener("click", lockVault);
  if (downloadBtn) downloadBtn.addEventListener("click", downloadDecryptedPdf);

  window.addEventListener("beforeunload", cleanupBlobUrl);
});