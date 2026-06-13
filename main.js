/*
This Js file handles scrolling, interface state changes, sound design,
map movement, and notification behaviour so the project can be experienced
as a temporal waiting system rather than a static webpage.

The code is structured around step states because the project's concept depends
on escalation: calm -> checking -> pause -> delay -> arrival.
*/
// Run the project only after the full interface is available.
// step text, map state, notifications, sound, and user-read cues.
document.addEventListener("DOMContentLoaded", () => {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  const steps = document.querySelectorAll(".step");
  const body = document.body;

  const uiTitle = document.getElementById("uiTitle");
  const uiEta = document.getElementById("uiEta");
  const uiStatus = document.getElementById("uiStatus");
  const uiProgress = document.getElementById("uiProgress");
  const uiRead = document.getElementById("uiRead");
  const uiAmbient = document.getElementById("uiAmbient");
  const userAction = document.getElementById("userAction");
  const userFeeling = document.getElementById("userFeeling");
  const stagePanel = document.querySelector(".stage-panel");
  const browserShell = document.querySelector(".browser-shell");
  const screen = document.querySelector(".screen");
  const peakOverlay = document.getElementById("peakOverlay");
  const globalPeakFlash = document.getElementById("globalPeakFlash");
  const uiMap = document.getElementById("uiMap");
  const rider = document.getElementById("rider");
  const labelA = document.getElementById("labelA");
  const labelB = document.getElementById("labelB");
  const labelC = document.getElementById("labelC");

  const soundPopup = document.getElementById("soundPopup");
  const enableSoundBtn = document.getElementById("enableSoundBtn");
  const skipSoundBtn = document.getElementById("skipSoundBtn");
  const soundToggle = document.getElementById("soundToggle");

  const notifyPopup = document.getElementById("notifyPopup");
  const notifyText = document.getElementById("notifyText");
  const microStatus = document.getElementById("microStatus");
  const peakWindowsContainer = document.getElementById("peakWindows");
  const toastEls = [
    document.getElementById("toastA"),
    document.getElementById("toastB"),
    document.getElementById("toastC"),
    document.getElementById("toastD"),
    document.getElementById("toastE"),
    document.getElementById("toastF"),
    document.getElementById("toastG"),
    document.getElementById("toastH"),
  ].filter(Boolean);
  const routeEls = document.querySelectorAll(
    ".route, .route-glow, .pickup-pin, .destination, .progress-fill",
  );

  const peakWindowMessages = [
    "ETA still 11 min",
    "No movement detected",
    "Route recalculating",
    "Delay reason pending",
    "Driver still paused",
    "Refresh requested",
    "No new control",
    "Check again?",
    "Still waiting",
    "Information updated",
  ];

  const peakWindowPositions = [
    { left: "6%", top: "15%" },
    { right: "5%", top: "18%" },
    { left: "18%", top: "35%" },
    { right: "12%", top: "42%" },
    { left: "7%", top: "55%" },
    { right: "6%", top: "57%" },
    { left: "35%", top: "20%" },
    { right: "27%", top: "66%" },
    { left: "28%", top: "68%" },
    { right: "20%", top: "58%" },
  ];

  // Audio elements from index.html
  const step1Cue = document.getElementById("step1Cue"); // app-notification.mp3
  const step2Cue = document.getElementById("step2Cue"); // map-appear.mp3
  const step3Cue = document.getElementById("step3Cue"); // step3.mp3 (unused as main layer now)
  const step4Cue = document.getElementById("step4Cue"); // step4.mp3 (unused as main layer now)
  const step5Cue = document.getElementById("step5Cue"); // step5_01.mp3 (base layer)
  const step7Cue = document.getElementById("step7Cue"); // step7.mp3 (anxiety overlay)
  const step8Cue = document.getElementById("step8Cue"); // step8.mp3 (release)

  let soundEnabled = false;
  let currentState = "";
  let currentLayer = null;
  let step1Played = false;
  let audioCtx = null;
  let anxietyOsc = null;
  let anxietyFilter = null;
  let anxietyGain = null;
  let pulseTimer = null;
  let peakTimer = null;
  const peakToastTimers = [];

  const typedOnce = new WeakSet();

  // Typewriter animation is only used once per text block.
  // This gives each state a sense of arrival without becoming repetitive on re-entry.
  function typeText(element, speed = 28) {
    if (!element) return;

    const fullText = element.dataset.fullText || element.textContent.trim();
    element.dataset.fullText = fullText;

    if (typedOnce.has(element)) {
      element.textContent = fullText;
      element.classList.remove("is-typing");
      element.classList.add("is-typed");
      return;
    }

    element.textContent = "";
    element.classList.remove("is-typed");
    element.classList.add("is-typing");

    let index = 0;

    const tick = () => {
      element.textContent = fullText.slice(0, index + 1);
      index += 1;

      if (index < fullText.length) {
        window.setTimeout(tick, speed);
      } else {
        element.classList.remove("is-typing");
        element.classList.add("is-typed");
        typedOnce.add(element);
      }
    };

    tick();
  }

  function clearBodyStateClasses(states) {
    Object.keys(states).forEach((key) => {
      body.classList.remove(`state-${key}`);
    });
  }

  // Notifications are treated as part of the affective system, not just functional UI.
  // They are designed to feel like emotional cues rather than just information,
  // so they are implemented with the same care as sound and map changes.
  function updateNotify(text, visible = true) {
    if (!notifyPopup || !notifyText) return;

    notifyText.textContent = text || "";

    if (visible && text) {
      notifyPopup.classList.add("is-visible");
    } else {
      notifyPopup.classList.remove("is-visible");
    }
  }

  function updateSoundToggle() {
    if (!soundToggle) return;

    soundToggle.classList.toggle("is-on", soundEnabled);
    soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    soundToggle.setAttribute(
      "aria-label",
      soundEnabled ? "Turn sound off" : "Turn sound on",
    );

    const label = soundToggle.querySelector(".sound-toggle-text");
    if (label) label.textContent = soundEnabled ? "Sound on" : "Sound off";
  }

  function setPeakVisuals(active) {
    window.clearInterval(peakTimer);
    peakTimer = null;
    peakToastTimers.splice(0).forEach((timer) => window.clearTimeout(timer));
    body.classList.remove("peak-flash-on", "peak-shift-on");
    if (stagePanel) stagePanel.style.removeProperty("transform");
    if (browserShell) browserShell.style.removeProperty("transform");
    if (screen) screen.style.removeProperty("filter");
    if (peakOverlay) {
      peakOverlay.style.removeProperty("opacity");
      peakOverlay.style.removeProperty("transform");
    }
    if (globalPeakFlash) {
      globalPeakFlash.style.removeProperty("opacity");
      globalPeakFlash.style.removeProperty("transform");
    }
    if (peakWindowsContainer) {
      peakWindowsContainer.hidden = !active;
      peakWindowsContainer.setAttribute("aria-hidden", String(!active));
      peakWindowsContainer.innerHTML = "";
      peakWindowsContainer.style.cssText = active
        ? [
            "position:absolute",
            "inset:0",
            "z-index:140",
            "display:block",
            "overflow:hidden",
            "pointer-events:none",
            "contain:layout paint",
          ].join(";")
        : "";
    }

    body.classList.toggle("is-peak-active", active);
    if (browserShell) browserShell.classList.toggle("is-peak-active", active);
    if (uiMap) uiMap.classList.toggle("state-peak", active);

    if (active) {
      void body.offsetHeight;
      let frame = 0;
      const shakes = [
        [-18, 7, -0.45, 0.82],
        [15, -8, 0.4, 0.28],
        [-12, -6, -0.32, 0.72],
        [17, 6, 0.38, 0.22],
      ];
      peakTimer = window.setInterval(() => {
        const [x, y, rotate, opacity] = shakes[frame % shakes.length];
        frame += 1;
        body.classList.toggle("peak-flash-on", frame % 2 === 0);
        body.classList.toggle("peak-shift-on", frame % 2 === 1);
        if (stagePanel) {
          stagePanel.style.transform = `translate(${x * 0.35}px, ${y * 0.35}px)`;
        }
        if (browserShell) {
          browserShell.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg)`;
        }
        if (screen) {
          screen.style.filter = frame % 2 === 0
            ? "saturate(1.65) brightness(1.12) contrast(1.08)"
            : "saturate(1.05) brightness(0.98) contrast(1)";
        }
        if (peakOverlay) {
          peakOverlay.style.opacity = String(opacity);
          peakOverlay.style.transform = `translate(${x * -0.25}px, ${y * -0.25}px)`;
        }
        if (globalPeakFlash) {
          globalPeakFlash.style.opacity = String(frame % 2 === 0 ? 0.58 : 0.14);
          globalPeakFlash.style.transform = `translate(${x * -0.2}px, ${y * -0.2}px)`;
        }
      }, 95);

      toastEls.forEach((toast) => {
        toast.style.animation = "none";
        void toast.offsetHeight;
        toast.style.removeProperty("animation");
      });

      const shuffledPositions = [...peakWindowPositions].sort(
        () => Math.random() - 0.5,
      );

      peakWindowMessages.forEach((message, index) => {
        if (!peakWindowsContainer) return;
        const windowEl = document.createElement("div");
        const position = shuffledPositions[index % shuffledPositions.length];
        windowEl.className = "peak-window is-visible";
        Object.assign(windowEl.style, position);
        Object.assign(windowEl.style, {
          position: "absolute",
          display: "flex",
          alignItems: "center",
          width: "265px",
          minHeight: "49px",
          padding: "14px 18px",
          borderRadius: "14px",
          border: "1px solid rgba(18, 28, 23, 0.1)",
          background: "rgba(255, 255, 255, 0.98)",
          color: "#121c17",
          boxShadow:
            "0 18px 40px rgba(18, 28, 23, 0.18), 0 0 30px rgba(255, 90, 79, 0.18)",
          fontSize: "15px",
          fontWeight: "900",
          lineHeight: "1.2",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          opacity: "1",
          zIndex: String(150 + index),
          transform: "translateY(0) scale(1)",
        });
        const dot = document.createElement("span");
        Object.assign(dot.style, {
          width: "12px",
          height: "12px",
          marginRight: "10px",
          flex: "0 0 auto",
          borderRadius: "50%",
          background: index % 3 === 1 ? "#ff9a2f" : "#ff5a4f",
          boxShadow:
            "0 0 0 4px rgba(255, 90, 79, 0.14), 0 0 14px rgba(255, 90, 79, 0.42)",
        });
        const label = document.createElement("span");
        label.textContent = message;
        label.style.overflow = "hidden";
        label.style.textOverflow = "ellipsis";
        label.style.whiteSpace = "nowrap";
        windowEl.append(dot, label);
        peakWindowsContainer.appendChild(windowEl);
      });
    }

    routeEls.forEach((element) => {
      if (active) {
        element.style.setProperty(
          "background",
          "linear-gradient(90deg, var(--red), var(--red-strong))",
          "important",
        );
        element.style.setProperty(
          "box-shadow",
          "0 0 26px rgba(255, 90, 79, 0.62), 0 0 62px rgba(255, 90, 79, 0.4)",
          "important",
        );
      } else {
        element.style.removeProperty("background");
        element.style.removeProperty("box-shadow");
      }
    });
  }

  /* -------------------------
     AUDIO HELPERS
  ------------------------- */

  const allAudios = [
    step1Cue,
    step2Cue,
    step3Cue,
    step4Cue,
    step5Cue,
    step7Cue,
    step8Cue,
  ].filter(Boolean);

  // Audio is reset here so each sound layer can be re-entered cleanly.
  // This is important because the work uses sound as an evolving atmosphere,
  // not as disconnected one-off effects.

  function prepareAudio() {
    allAudios.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = false;
      audio.volume = 0;
    });

    if (step5Cue) step5Cue.loop = true;
    if (step7Cue) step7Cue.loop = true;
    if (step8Cue) step8Cue.loop = false;
  }

  async function unlockAudio() {
    try {
      if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx?.state === "suspended") {
        await audioCtx.resume();
      }

      const plays = allAudios.map(async (audio) => {
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      });
      await Promise.allSettled(plays);
    } catch (error) {
      console.warn("Audio unlock failed:", error);
    }
  }

  // The synth layer adds a low electronic pressure under the existing audio files.
  // It is used to push the project beyond realistic app sound
  // and into affective tension.

  function ensureAnxietySynth() {
    if (!soundEnabled || !audioCtx) return false;
    if (anxietyOsc && anxietyGain && anxietyFilter) return true;

    anxietyOsc = audioCtx.createOscillator();
    anxietyFilter = audioCtx.createBiquadFilter();
    anxietyGain = audioCtx.createGain();

    anxietyOsc.type = "sawtooth";
    anxietyOsc.frequency.value = 54;
    anxietyFilter.type = "lowpass";
    anxietyFilter.frequency.value = 220;
    anxietyFilter.Q.value = 5;
    anxietyGain.gain.value = 0;

    anxietyOsc.connect(anxietyFilter);
    anxietyFilter.connect(anxietyGain);
    anxietyGain.connect(audioCtx.destination);
    anxietyOsc.start();
    return true;
  }

  function stopPulseLoop() {
    if (pulseTimer) {
      window.clearInterval(pulseTimer);
      pulseTimer = null;
    }
  }

  // This synthetic blip acts like an exaggerated timer pulse.
  // It is introduced gradually so the user feels increasing urgency
  // rather than a sudden jump scare.

  function playAnxietyBlip(intensity = 0.5) {
    if (!soundEnabled || !audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = "square";
    osc.frequency.setValueAtTime(620 + intensity * 220, now);
    osc.frequency.exponentialRampToValueAtTime(
      210 + intensity * 80,
      now + 0.12,
    );
    filter.type = "bandpass";
    filter.frequency.value = 900 + intensity * 320;
    filter.Q.value = 7;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      0.045 + intensity * 0.035,
      now + 0.012,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  function playArrivalChime() {
    if (!soundEnabled || !audioCtx) return;

    const now = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
    gain.connect(audioCtx.destination);

    [660, 880].forEach((frequency, index) => {
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, now + index * 0.12);
      osc.connect(gain);
      osc.start(now + index * 0.12);
      osc.stop(now + 0.72);
    });
  }

  function startPulseLoop(interval, intensity) {
    stopPulseLoop();
    playAnxietyBlip(intensity);
    pulseTimer = window.setInterval(() => playAnxietyBlip(intensity), interval);
  }

  function setAnxietySynth(level = 0) {
    if (!soundEnabled || !audioCtx) return;
    if (!ensureAnxietySynth()) return;

    const now = audioCtx.currentTime;
    const targetGain = Math.max(0, Math.min(level, 1)) * 0.075;
    const targetFreq = 48 + level * 28;
    const targetFilter = 180 + level * 520;

    anxietyOsc.frequency.cancelScheduledValues(now);
    anxietyFilter.frequency.cancelScheduledValues(now);
    anxietyGain.gain.cancelScheduledValues(now);
    anxietyOsc.frequency.linearRampToValueAtTime(targetFreq, now + 0.28);
    anxietyFilter.frequency.linearRampToValueAtTime(targetFilter, now + 0.28);
    anxietyGain.gain.linearRampToValueAtTime(targetGain, now + 0.28);
  }

  function stopAnxietySynth(duration = 0.5) {
    stopPulseLoop();
    if (!audioCtx || !anxietyGain) return;

    const now = audioCtx.currentTime;
    anxietyGain.gain.cancelScheduledValues(now);
    anxietyGain.gain.linearRampToValueAtTime(0, now + duration);
  }

  function fadeAudio(audio, targetVolume, duration = 500) {
    if (!audio) return;

    const startVolume = Number(audio.volume || 0);
    const startTime = performance.now();

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      audio.volume = startVolume + (targetVolume - startVolume) * progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        audio.volume = targetVolume;
        if (targetVolume <= 0.001) {
          audio.pause();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  function playOneShot(audio, volume = 0.5) {
    if (!soundEnabled || !audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = false;
      audio.volume = volume;
      audio.play().catch(() => {});
    } catch (error) {
      console.warn("One-shot playback failed:", error);
    }
  }

  function switchLayer(nextAudio, targetVolume = 0.3, fadeDuration = 600) {
    if (!soundEnabled || !nextAudio) return;

    if (currentLayer === nextAudio) {
      fadeAudio(nextAudio, targetVolume, fadeDuration);
      return;
    }

    if (currentLayer && currentLayer !== nextAudio) {
      fadeAudio(currentLayer, 0, fadeDuration);
    }

    currentLayer = nextAudio;

    try {
      nextAudio.loop = true;
      nextAudio.volume = 0;
      nextAudio.play().catch(() => {});
      fadeAudio(nextAudio, targetVolume, fadeDuration);
    } catch (error) {
      console.warn("Layer switch failed:", error);
    }
  }

  function stopMainLayer(fadeDuration = 600) {
    if (currentLayer) {
      fadeAudio(currentLayer, 0, fadeDuration);
      currentLayer = null;
    }
  }

  function stopOverlayLayer(audio, fadeDuration = 500) {
    if (audio && !audio.paused) {
      fadeAudio(audio, 0, fadeDuration);
    }
  }

  // The base layer is a very soft continuous time cue.
  // Starting it early supports the concept that waiting begins
  // before anything visibly goes wrong.

  function ensureBaseLayer(volume = 0.12, duration = 1200) {
    if (!soundEnabled || !step5Cue) return;

    if (currentLayer !== step5Cue) {
      switchLayer(step5Cue, volume, duration);
    } else {
      fadeAudio(step5Cue, volume, duration);
    }
  }

  /* -------------------------
     STEP SOUND DESIGN
  ------------------------- */

  function soundStep1() {
    if (!soundEnabled) return;
    playOneShot(step1Cue, 0.48);
  }

  function soundStep1Bed() {
    if (!soundEnabled) return;
    ensureBaseLayer(0.12, 1400);
  }

  function soundStep2() {
    if (!soundEnabled) return;
    stopAnxietySynth(0.4);
    playOneShot(step2Cue, 0.5);
  }

  function soundStep3() {
    if (!soundEnabled) return;
    stopPulseLoop();
    ensureBaseLayer(0.14, 500);
    setAnxietySynth(0.12);
  }

  function soundStep4() {
    if (!soundEnabled) return;
    stopPulseLoop();
    ensureBaseLayer(0.16, 500);
    setAnxietySynth(0.18);
  }

  // Step 5 shifts attention from route to time.
  // The sound becomes more measurable
  // and repetitive to reinforce checking behaviour.

  function soundStep5() {
    if (!soundEnabled) return;
    ensureBaseLayer(0.2, 650);
    setAnxietySynth(0.42);
    startPulseLoop(1400, 0.34);
  }

  // Step 6 is not just "more sound".
  // It changes the quality of the sound
  // so the pause feels suspicious and harder to ignore.

  function soundStep6() {
    if (!soundEnabled) return;
    ensureBaseLayer(0.22, 500);
    setAnxietySynth(0.7);
    startPulseLoop(820, 0.58);
  }

  // Step 7 is the peak anxiety state.
  // Here the work layers base timing, warning audio, and synthetic pressure
  // so the interface feels more visible but less reassuring.

  function soundStep7() {
    if (!soundEnabled) return;

    // keep base layer alive
    ensureBaseLayer(0.22, 400);

    // add anxiety overlay
    if (step7Cue) {
      step7Cue.loop = true;
      if (step7Cue.paused) {
        step7Cue.volume = 0;
        step7Cue.play().catch(() => {});
      }
      fadeAudio(step7Cue, 0.38, 500);
    }

    setAnxietySynth(0.96);
    startPulseLoop(420, 0.9);
  }

  function soundStep7Peak() {
    if (!soundEnabled) return;

    ensureBaseLayer(0.24, 250);

    if (step7Cue) {
      step7Cue.loop = true;
      if (step7Cue.paused) {
        step7Cue.volume = 0;
        step7Cue.play().catch(() => {});
      }
      fadeAudio(step7Cue, 0.48, 260);
    }

    setAnxietySynth(1);
    startPulseLoop(260, 1);
  }

  function soundStep8() {
    if (!soundEnabled) return;

    playArrivalChime();
    stopAnxietySynth(1.15);
    stopOverlayLayer(step7Cue, 900);
    if (step5Cue && !step5Cue.paused) {
      fadeAudio(step5Cue, 0.06, 450);
      window.setTimeout(() => fadeAudio(step5Cue, 0, 900), 520);
    }
    currentLayer = null;

    playOneShot(step8Cue, 0.42);
  }

  function soundStep9() {
    if (!soundEnabled) return;

    stopAnxietySynth(0.7);
    stopOverlayLayer(step7Cue, 600);
    if (step5Cue && !step5Cue.paused) {
      fadeAudio(step5Cue, 0, 800);
    }
    currentLayer = null;
  }

  // Each narrative state has a matching sound behaviour.
  // This keeps the audio aligned with interface escalation
  // rather than playing independently of it.

  function playSoundForState(key) {
    if (key === "step1" && !step1Played) {
      soundStep1();
      step1Played = true;

      window.setTimeout(() => {
        if (soundEnabled && currentState === "step1") {
          soundStep1Bed();
        }
      }, 450);
      return;
    }

    if (key === "step1") soundStep1Bed();
    if (key === "step2") soundStep2();
    if (key === "step3") soundStep3();
    if (key === "step4") soundStep4();
    if (key === "step5") soundStep5();
    if (key === "step6") soundStep6();
    if (key === "step7") soundStep7();
    if (key === "step7peak") soundStep7Peak();
    if (key === "step8") soundStep8();
    if (key === "step9") soundStep9();
  }

  async function enableSound() {
    soundEnabled = true;
    updateSoundToggle();
    prepareAudio();
    await unlockAudio();

    if (soundPopup) {
      soundPopup.classList.remove("is-visible");
    }

    playSoundForState(currentState || "step1");
  }

  function disableSound() {
    soundEnabled = false;
    updateSoundToggle();
    stopAnxietySynth(0.2);
    stopOverlayLayer(step7Cue, 300);
    stopMainLayer(300);

    if (step5Cue && !step5Cue.paused) fadeAudio(step5Cue, 0, 300);
    if (soundPopup) {
      soundPopup.classList.remove("is-visible");
    }
  }

  /* -------------------------
     STATE DATA
  ------------------------- */

  // State data drives the entire interface.
  // Each state combines text, ETA, rider position, notifications, toast density,,
  // and emotional framing so the interface can shift as one coherent system.

  const states = {
    step1: {
      title: "Order confirmed",
      subtitle: "The wait is still quiet.",
      eta: "12 min away",
      status: "Preparing order",
      progress: "18%",
      riderLeft: "27%",
      riderTop: "21.4%",
      read: "The restaurant has your order.",
      ambient: "The room is quiet. The app is open.",
      userAction: "Your order is open",
      userFeeling: "You have not started checking yet.",
      labelA: "Restaurant",
      labelB: "",
      labelC: "Drop-off",
      mapClass: "state-confirmed",
      notify: "",
      notifyVisible: false,
      micro: "route inactive",
      toastVisible: 0,
      toasts: [
        "kitchen accepted",
        "waiting at home",
        "estimate ready",
        "pickup pending",
        "route not visible yet",
        "nothing to check yet",
        "nothing to do yet",
        "screen open",
      ],
      toastIcons: [
        "food",
        "home",
        "timer",
        "route",
        "route",
        "eye",
        "hand",
        "phone",
      ],
    },

    step2: {
      title: "Tracking active",
      subtitle: "The wait now has a shape.",
      eta: "8 min away",
      status: "Driver picked up",
      progress: "34%",
      riderLeft: "35%",
      riderTop: "21.4%",
      read: "The driver picked it up.",
      ambient: "There is finally something to watch.",
      userAction: "You open the tracker",
      userFeeling: "The moving dot makes the wait feel watchable.",
      labelA: "Restaurant",
      labelB: "Live tracking",
      labelC: "Drop-off",
      mapClass: "state-visible",
      notify: "Driver is on the way",
      notifyVisible: true,
      micro: "live tracking",
      toastVisible: 2,
      toasts: [
        "driver picked up",
        "movement online",
        "map opened",
        "8 min away",
        "nearby streets visible",
        "you check the dot",
        "nothing to do yet",
        "screen still open",
      ],
      toastIcons: [
        "rider",
        "route",
        "map",
        "timer",
        "map",
        "eye",
        "hand",
        "phone",
      ],
    },

    step3: {
      title: "You check again",
      subtitle: "A small change. Still worth checking.",
      eta: "7 min away",
      status: "Moving",
      progress: "46%",
      riderLeft: "45.5%",
      riderTop: "21.4%",
      read: "The map has moved a little.",
      ambient: "The small change makes you look again.",
      userAction: "You check again",
      userFeeling: "A small update keeps your thumb near the screen.",
      labelA: "Check logged",
      labelB: "Minor progress",
      labelC: "Still waiting",
      mapClass: "state-checking",
      notify: "Live location updated",
      notifyVisible: true,
      micro: "attention rising",
      toastVisible: 3,
      toasts: [
        "you checked",
        "returning view",
        "location refreshed",
        "minor progress",
        "ETA still visible",
        "map feels useful",
        "nothing to do yet",
        "screen stays awake",
      ],
      toastIcons: [
        "eye",
        "phone",
        "map",
        "route",
        "timer",
        "map",
        "hand",
        "phone",
      ],
    },

    step4: {
      title: "You look once more",
      subtitle: "Almost nothing changed.",
      eta: "7 min away",
      status: "Almost unchanged",
      progress: "48%",
      riderLeft: "48.6%",
      riderTop: "31%",
      read: "The route is almost the same.",
      ambient: "The update appears, but your body does not relax.",
      userAction: "You refresh again",
      userFeeling: "The screen responds, but the wait does not loosen.",
      labelA: "Second check",
      labelB: "Minimal change",
      labelC: "Same route",
      mapClass: "state-checking",
      notify: "Still nearby",
      notifyVisible: true,
      micro: "checking loop",
      toastVisible: 4,
      toasts: [
        "same route",
        "nothing resolved",
        "location refreshed",
        "ETA unchanged",
        "driver nearby",
        "map reopened",
        "nothing to do yet",
        "you keep looking",
      ],
      toastIcons: [
        "route",
        "alert",
        "map",
        "timer",
        "rider",
        "phone",
        "hand",
        "eye",
      ],
    },

    step5: {
      title: "The timer keeps counting",
      subtitle: "7 min. Still 7.",
      eta: "7 min away",
      status: "Timer active",
      progress: "49%",
      riderLeft: "48.6%",
      riderTop: "40%",
      read: "The ETA refreshes without changing.",
      ambient: "The number starts to feel louder than the room.",
      userAction: "You keep watching the timer",
      userFeeling: "The number repeats until it feels heavier.",
      labelA: "ETA active",
      labelB: "7 min away",
      labelC: "Live route",
      mapClass: "state-measured",
      notify: "ETA refreshed",
      notifyVisible: true,
      micro: "countdown visible",
      toastVisible: 6,
      toasts: [
        "timer refreshed",
        "still 7 min",
        "still 7 min",
        "refreshing again",
        "why still 7?",
        "route recalculating",
        "nothing to do",
        "you keep checking",
      ],
      toastIcons: [
        "timer",
        "timer",
        "timer",
        "phone",
        "alert",
        "route",
        "hand",
        "eye",
      ],
    },

    step6: {
      title: "Then the car stops",
      subtitle: "The pause feels bigger now.",
      eta: "7 min away",
      status: "No movement",
      progress: "49%",
      riderLeft: "48.6%",
      riderTop: "40%",
      read: "The driver has stopped.",
      ambient: "The room is still, and now the map is too.",
      userAction: "You stare at the stopped car",
      userFeeling: "The pause becomes impossible to ignore.",
      labelA: "Paused",
      labelB: "No movement",
      labelC: "Still tracking",
      mapClass: "state-paused",
      notify: "Driver has stopped",
      notifyVisible: true,
      micro: "movement paused",
      toastVisible: 8,
      toasts: [
        "route stalled",
        "no movement",
        "same street",
        "still not moving",
        "checking route",
        "driver still there",
        "delay reason pending",
        "you stare longer",
      ],
      toastIcons: [
        "alert",
        "alert",
        "map",
        "alert",
        "route",
        "rider",
        "timer",
        "eye",
      ],
    },

    // The state deliberately increases information
    // while reducing reassurance.
    // ETA changes, warning language appears,
    // and the system becomes visually and sonically more hostile.

    step7: {
      title: "Now the time changes",
      subtitle: "You know more. You control nothing.",
      eta: "11 min away",
      status: "ETA updated",
      progress: "49%",
      riderLeft: "48.6%",
      riderTop: "40%",
      read: "The ETA jumps up.",
      ambient: "More messages arrive, but none of them help.",
      userAction: "You receive more information",
      userFeeling: "More visibility, less reassurance.",
      labelA: "Delay",
      labelB: "11 min away",
      labelC: "Still on route",
      mapClass: "state-delay",
      notify: "Delivery delayed",
      notifyVisible: true,
      micro: "warning state",
      toastVisible: 8,
      toasts: [
        "ETA revised",
        "nothing you can do",
        "11 min away",
        "driver paused",
        "delay reason pending",
        "refresh again",
        "check again",
        "too much information",
      ],
      toastIcons: [
        "alert",
        "hand",
        "timer",
        "rider",
        "timer",
        "phone",
        "eye",
        "alert",
      ],
    },

    step7peak: {
      title: "Too much information",
      subtitle: "Every update asks for another check.",
      eta: "11 min away",
      status: "Warning overload",
      progress: "49%",
      riderLeft: "48.6%",
      riderTop: "40%",
      read: "The screen keeps producing signals.",
      ambient: "The information gets louder than the order.",
      userAction: "You check again",
      userFeeling: "The alerts make the wait feel larger.",
      labelA: "Delay",
      labelB: "11 min away",
      labelC: "Still no control",
      mapClass: "state-delay state-peak",
      notify: "Warning: no new control",
      notifyVisible: true,
      micro: "warning state",
      toastVisible: 8,
      toasts: [
        "refresh again",
        "ETA still 11 min",
        "route recalculating",
        "driver paused",
        "delay reason pending",
        "check again",
        "no new control",
        "too much information",
      ],
      toastIcons: [
        "alert",
        "timer",
        "alert",
        "rider",
        "timer",
        "phone",
        "alert",
        "alert",
      ],
    },

    step8: {
      title: "The food arrives",
      subtitle: "The order arrives. The feeling stays.",
      eta: "Complete",
      status: "Delivered",
      progress: "100%",
      riderLeft: "75%",
      riderTop: "50%",
      read: "Delivered.",
      ambient: "The room comes back into focus.",
      userAction: "You get the delivery photo",
      userFeeling: "The order is here, but your attention is still caught.",
      labelA: "Delivered",
      labelB: "Complete",
      labelC: "Arrived",
      mapClass: "state-delivered",
      notify: "Delivered",
      notifyVisible: true,
      micro: "",
      toastVisible: 1,
      toasts: [
        "Delivered",
        "",
        "Route complete",
        "Tracking closed",
        "",
        "",
        "",
        "",
      ],
      toastIcons: [
        "done",
        "photo",
        "route",
        "done",
        "food",
        "phone",
        "home",
        "eye",
      ],
    },

    step9: {
      title: "More visibility did not make the wait easier",
      subtitle: "You saw more, but settled less.",
      eta: "Seen",
      status: "Reflection",
      progress: "100%",
      riderLeft: "75%",
      riderTop: "50%",
      read: "Delay became clearer on screen, but harder to settle in the mind.",
      ambient: "What looked like reassurance changed the wait.",
      userAction: "You leave the tracker",
      userFeeling: "The app is closed. The checking habit remains.",
      labelA: "Delay noticed",
      labelB: "Attention captured",
      labelC: "Control unchanged",
      mapClass: "state-reflection",
      notify: "",
      notifyVisible: false,
      micro: "",
      toastVisible: 0,
      toasts: ["", "", "", "", "", "", "", ""],
      toastIcons: [
        "done",
        "eye",
        "eye",
        "route",
        "timer",
        "home",
        "hand",
        "done",
      ],
    },
  };

  if (enableSoundBtn) {
    enableSoundBtn.addEventListener("click", async () => {
      await enableSound();
    });
  }

  if (skipSoundBtn) {
    skipSoundBtn.addEventListener("click", () => {
      disableSound();
    });
  }

  if (soundToggle) {
    soundToggle.addEventListener("click", async () => {
      if (soundEnabled) {
        disableSound();
      } else {
        await enableSound();
      }
    });
  }

  // applyState is the core narrative controller.
  // Instead of switching pages, the project mutates one live interface,
  // reflecting the experience of repeatedly returning to the same delivery app screen.

  function applyState(key) {
    const state = states[key];
    if (!state) return;
    if (currentState === key) return;

    currentState = key;

    clearBodyStateClasses(states);
    body.classList.add(`state-${key}`);
    setPeakVisuals(key === "step7peak");

    if (uiTitle) uiTitle.textContent = state.title;
    if (uiEta) uiEta.textContent = state.eta;
    if (uiStatus) uiStatus.textContent = state.status;
    if (uiProgress) uiProgress.style.width = state.progress;
    if (uiRead) uiRead.textContent = state.read;
    if (uiAmbient) uiAmbient.textContent = state.ambient;
    if (userAction) userAction.textContent = state.userAction;
    if (userFeeling) userFeeling.textContent = state.userFeeling;

    if (microStatus) {
      microStatus.textContent = state.micro || "";
      microStatus.classList.toggle("is-hidden", !state.micro);
    }
    toastEls.forEach((toast, index) => {
      const text = state.toasts?.[index] || "";
      toast.textContent = text;
      toast.hidden = !text;
      toast.classList.toggle("is-empty", !text);
      const visible = Boolean(text) && index < (state.toastVisible || 0);
      toast.classList.toggle("is-visible", visible && key !== "step7peak");
      toast.dataset.icon = state.toastIcons?.[index] || "dot";

      if (key === "step7peak" && visible) {
        toast.hidden = true;
        toast.classList.remove("is-visible");
      }
    });

    if (rider) {
      rider.style.left = state.riderLeft;
      rider.style.top = state.riderTop;
    }

    if (labelA) labelA.textContent = state.labelA;
    if (labelB) labelB.textContent = state.labelB;
    if (labelC) labelC.textContent = state.labelC;

    if (uiMap) {
      uiMap.className = `map-panel ${state.mapClass}`;
    }

    updateNotify(state.notify, state.notifyVisible);

    if (soundEnabled) playSoundForState(key);

    if (key === "step6" || key === "step7" || key === "step7peak") {
      rider.style.animation = "none";
    } else {
      rider.style.animation = "float-car 1.8s ease-in-out infinite";
    }
  }

  // Scroll triggers state changes because scrolling stands in for elapsed waiting time.
  // The user does not click through a story, they move through phases of attention.

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        steps.forEach((step) => step.classList.remove("is-active"));
        entry.target.classList.add("is-active");

        applyState(entry.target.dataset.state);

        const titleToType = entry.target.querySelector(".type-target");
        const bodyToType = entry.target.querySelector(".type-body");

        typeText(titleToType, 26);
        typeText(bodyToType, 12);
      });
    },
    {
      threshold: 0.55,
    },
  );

  steps.forEach((step) => observer.observe(step));

  updateSoundToggle();
  applyState("step1");
});
