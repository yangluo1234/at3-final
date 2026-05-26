document.addEventListener("DOMContentLoaded", () => {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  const steps = document.querySelectorAll(".step");
  const body = document.body;

  const uiTitle = document.getElementById("uiTitle");
  const uiSubtitle = document.getElementById("uiSubtitle");
  const uiEta = document.getElementById("uiEta");
  const uiStatus = document.getElementById("uiStatus");
  const uiProgress = document.getElementById("uiProgress");
  const uiRead = document.getElementById("uiRead");
  const uiAmbient = document.getElementById("uiAmbient");
  const uiMap = document.getElementById("uiMap");
  const rider = document.getElementById("rider");
  const labelA = document.getElementById("labelA");
  const labelB = document.getElementById("labelB");
  const labelC = document.getElementById("labelC");

  const soundPopup = document.getElementById("soundPopup");
  const enableSoundBtn = document.getElementById("enableSoundBtn");
  const skipSoundBtn = document.getElementById("skipSoundBtn");
  const enterWait = document.getElementById("enterWait");

  const step1Cue = document.getElementById("step1Cue");
  const step2Cue = document.getElementById("step2Cue");
  const step3Cue = document.getElementById("step3Cue");
  const step4Cue = document.getElementById("step4Cue");
  const step5Cue = document.getElementById("step5Cue");
  const step7Cue = document.getElementById("step7Cue");
  const step8Cue = document.getElementById("step8Cue");

  let soundEnabled = false;
  let currentState = "";
  let step1Played = false;

  const typedOnce = new WeakSet();

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

  const states = {
    step1: {
      title: "Order confirmed",
      subtitle: "Your delivery has been received.",
      eta: "12 min away",
      status: "Preparing order",
      progress: "18%",
      riderLeft: "18%",
      riderTop: "56%",
      read: "A normal and familiar wait begins.",
      ambient: "Nothing feels urgent yet.",
      labelA: "Order placed",
      labelB: "",
      labelC: "",
      mapClass: "state-confirmed",
    },

    step2: {
      title: "On the way",
      subtitle: "The rider has picked up your order.",
      eta: "8 min away",
      status: "Picked up",
      progress: "34%",
      riderLeft: "31%",
      riderTop: "46%",
      read: "The wait now has a visible shape.",
      ambient: "The system feels active now.",
      labelA: "Picked up",
      labelB: "Live tracking",
      labelC: "Destination",
      mapClass: "state-visible",
    },

    step3: {
      title: "Still on the way",
      subtitle: "You check again.",
      eta: "7 min away",
      status: "Rider moving",
      progress: "46%",
      riderLeft: "41%",
      riderTop: "39%",
      read: "The rider has moved, but only a little.",
      ambient: "Small updates keep your attention.",
      labelA: "Checked again",
      labelB: "Minor progress",
      labelC: "Still waiting",
      mapClass: "state-checking",
    },

    step4: {
      title: "Still on the way",
      subtitle: "Almost nothing has changed.",
      eta: "7 min away",
      status: "Almost unchanged",
      progress: "48%",
      riderLeft: "42%",
      riderTop: "38.5%",
      read: "The screen still feels worth checking.",
      ambient: "The wait stays in view.",
      labelA: "Look again",
      labelB: "Minimal change",
      labelC: "Same route",
      mapClass: "state-checking",
    },

    step5: {
      title: "Tracking active",
      subtitle: "The timer keeps counting.",
      eta: "7 min away",
      status: "Time visible",
      progress: "49%",
      riderLeft: "42.5%",
      riderTop: "38.2%",
      read: "The timer makes the wait measurable.",
      ambient: "Now the wait can be counted.",
      labelA: "ETA active",
      labelB: "7 min away",
      labelC: "Live route",
      mapClass: "state-measured",
    },

    step6: {
      title: "Paused nearby",
      subtitle: "The rider has stopped for a moment.",
      eta: "7 min away",
      status: "Movement paused",
      progress: "49%",
      riderLeft: "42.5%",
      riderTop: "38.2%",
      read: "A small pause feels larger when you can see it.",
      ambient: "The pause becomes noticeable.",
      labelA: "Paused",
      labelB: "No movement",
      labelC: "Still tracking",
      mapClass: "state-paused",
    },

    step7: {
      title: "Slight delay",
      subtitle: "The wait becomes more noticeable.",
      eta: "11 min away",
      status: "ETA updated",
      progress: "49%",
      riderLeft: "42.5%",
      riderTop: "38.2%",
      read: "Seeing more does not mean controlling more.",
      ambient: "The delay feels heavier now.",
      labelA: "Delay",
      labelB: "11 min away",
      labelC: "Still on route",
      mapClass: "state-delay",
    },

    step8: {
      title: "Delivered",
      subtitle: "Your order has arrived.",
      eta: "Complete",
      status: "Delivered",
      progress: "100%",
      riderLeft: "76%",
      riderTop: "26%",
      read: "The wait is over, but the feeling remains.",
      ambient: "The tension drops away.",
      labelA: "Delivered",
      labelB: "Complete",
      labelC: "Arrived",
      mapClass: "state-delivered",
    },

    step9: {
      title: "Reflection",
      subtitle: "The interface changed how the wait felt.",
      eta: "Seen",
      status: "Waiting redesigned",
      progress: "100%",
      riderLeft: "76%",
      riderTop: "26%",
      read: "Tracking maps do not remove waiting. They change how waiting feels.",
      ambient: "What looked like reassurance changed the experience.",
      labelA: "Delay noticed",
      labelB: "Attention captured",
      labelC: "Control unchanged",
      mapClass: "state-reflection",
    },
  };

  if (enableSoundBtn) {
    enableSoundBtn.addEventListener("click", () => {
      soundEnabled = true;

      if (step1Cue) {
        step1Cue.currentTime = 0;
        step1Cue.play().catch(() => {});
        step1Cue.pause();
        step1Cue.currentTime = 0;
      }

      if (soundPopup) {
        soundPopup.classList.remove("is-visible");
      }
    });
  }

  if (skipSoundBtn) {
    skipSoundBtn.addEventListener("click", () => {
      soundEnabled = false;
      if (soundPopup) {
        soundPopup.classList.remove("is-visible");
      }
    });
  }

  if (enterWait) {
    enterWait.addEventListener("click", () => {
      if (soundEnabled && step1Cue) {
        step1Cue.currentTime = 0;
        step1Cue.play().catch(() => {});
        step1Played = true;
      }
    });
  }

  function applyState(key) {
    const state = states[key];
    if (!state) return;
    if (currentState === key) return;

    currentState = key;

    clearBodyStateClasses(states);
    body.classList.add(`state-${key}`);

    if (uiTitle) uiTitle.textContent = state.title;
    if (uiSubtitle) uiSubtitle.textContent = state.subtitle;
    if (uiEta) uiEta.textContent = state.eta;
    if (uiStatus) uiStatus.textContent = state.status;
    if (uiProgress) uiProgress.style.width = state.progress;
    if (uiRead) uiRead.textContent = state.read;
    if (uiAmbient) uiAmbient.textContent = state.ambient;

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

    if (key === "step1" && soundEnabled && !step1Played && step1Cue) {
      step1Played = true;
      step1Cue.currentTime = 0;
      step1Cue.play().catch(() => {});
    }

    if (key === "step2" && soundEnabled && step2Cue) {
      step2Cue.currentTime = 0;
      step2Cue.play().catch(() => {});
    }

    if (key === "step3" && soundEnabled && step3Cue) {
      step3Cue.currentTime = 0;
      step3Cue.play().catch(() => {});
    }

    if (key === "step4" && soundEnabled && step4Cue) {
      step4Cue.currentTime = 0;
      step4Cue.play().catch(() => {});
    }

    if (key === "step5" && soundEnabled && step5Cue) {
      step5Cue.currentTime = 0;
      step5Cue.play().catch(() => {});
    }

    if (key === "step7" && soundEnabled && step7Cue) {
      step7Cue.currentTime = 0;
      step7Cue.play().catch(() => {});
    }

    if (key === "step8" && soundEnabled && step8Cue) {
      step8Cue.currentTime = 0;
      step8Cue.play().catch(() => {});
    }
  }

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

  applyState("step1");
});
