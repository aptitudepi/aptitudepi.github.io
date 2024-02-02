/*
	Hyperspace by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

import THREE from './three.module.js';

(function ($) {
  // Three.js WebGL Globe
  $("#globe").css({ marginTop: "-200px" });
  const world = Globe()(document.getElementById("globe"))
    .backgroundColor("rgba(0,0,0,0)")
    .showGlobe(false)
    .showAtmosphere(false)

  const interpolateColor = (startColor, endColor, interpolation) => {
    const startRGB = new THREE.Color(startColor);
    const endRGB = new THREE.Color(endColor);
    const resultRGB = new THREE.Color().lerpColors(
      startRGB,
      endRGB,
      interpolation
    );
    return resultRGB.getStyle();
  };

  const updateGlobeColor = (time) => {
    const red = "red";
    const blue = "blue";
    const yellow = "yellow";

    let interpolatedColor;
    if (time < 0.3333) {
      // Transition from red to blue
      const interpolation = time * 3; // Scale time to [0, 1]
      interpolatedColor = interpolateColor(red, blue, interpolation);
    } else if (time < 0.6666) {
      // Transition from blue to yellow
      const interpolation = (time - 0.3333) * 3; // Scale time to [0, 1]
      interpolatedColor = interpolateColor(blue, yellow, interpolation);
    } else {
      // Transition from yellow back to red
      const interpolation = (time - 0.6666) * 3; // Scale time to [0, 1]
      interpolatedColor = interpolateColor(yellow, red, interpolation);
    }

    world.polygonCapMaterial(
      new THREE.MeshLambertMaterial({
        color: interpolatedColor,
        side: THREE.DoubleSide,
      })
    );
  };

  const animate = () => {
    let startTime = null;
    const timeScaleFactor = 3; // Adjust this factor to control the animation speed
    const duration = 15000; // Animation duration in milliseconds

    const animateStep = (timestamp) => {
      if (!startTime) startTime = timestamp;

      const elapsed = (timestamp - startTime) * timeScaleFactor;
      const progress = (elapsed / duration) % 1; // Use modulo to loop the animation

      updateGlobeColor(progress);

      requestAnimationFrame(animateStep);
    };

    requestAnimationFrame(animateStep);
  };

  fetch("assets/land-110m.json")
    .then((res) => res.json())
    .then((landTopo) => {
      world
        .polygonsData(
          topojson.feature(landTopo, landTopo.objects.land).features
        )
        .polygonSideColor(() => "rgba(0,0,0,0)");

      animate(); // Start the animation
      world.controls().autoRotate = true;
      world.controls().autoRotateSpeed = 1.8;
      world.controls().enableZoom = false;
    });

  // Typing Carousel Effect

  const carouselText = [
    { text: "Devkumar!", color: "blue" },
    { text: "a student!", color: "red" },
    { text: "a developer!", color: "yellow" },
  ];

  $(document).ready(async function () {
    carousel(carouselText, "#feature-text");
  });

  async function typeSentence(sentence, eleRef, delay = 100) {
    const letters = sentence.split("");
    let i = 0;
    while (i < letters.length) {
      await waitForMs(delay);
      $(eleRef).append(letters[i]);
      i++;
    }
    return;
  }

  async function deleteSentence(eleRef) {
    const sentence = $(eleRef).html();
    const letters = sentence.split("");
    let i = 0;
    while (letters.length > 0) {
      await waitForMs(100);
      letters.pop();
      $(eleRef).html(letters.join(""));
    }
  }

  async function carousel(carouselList, eleRef) {
    var i = 0;
    while (true) {
      updateFontColor(eleRef, carouselList[i].color);
      await typeSentence(carouselList[i].text, eleRef);
      await waitForMs(1500);
      await deleteSentence(eleRef);
      await waitForMs(500);
      i++;
      if (i >= carouselList.length) {
        i = 0;
      }
    }
  }

  function updateFontColor(eleRef, color) {
    $(eleRef).css("color", color);
  }

  function waitForMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  var $window = $(window),
    $body = $("body"),
    $sidebar = $("#sidebar");

  // Breakpoints.
  breakpoints({
    xlarge: ["1281px", "1680px"],
    large: ["981px", "1280px"],
    medium: ["737px", "980px"],
    small: ["481px", "736px"],
    xsmall: [null, "480px"],
  });

  // Hack: Enable IE flexbox workarounds.
  if (browser.name == "ie") $body.addClass("is-ie");

  // Play initial animations on page load.
  $window.on("load", function () {
    window.setTimeout(function () {
      $body.removeClass("is-preload");
    }, 100);
  });

  // Forms.

  // Hack: Activate non-input submits.
  $("form").on("click", ".submit", function (event) {
    // Stop propagation, default.
    event.stopPropagation();
    event.preventDefault();

    // Submit form.
    $(this).parents("form").submit();
  });

  // Sidebar.
  if ($sidebar.length > 0) {
    var $sidebar_a = $sidebar.find("a");

    $sidebar_a
      .addClass("scrolly")
      .on("click", function () {
        var $this = $(this);

        // External link? Bail.
        if ($this.attr("href").charAt(0) != "#") return;

        // Deactivate all links.
        $sidebar_a.removeClass("active");

        // Activate link *and* lock it (so Scrollex doesn't try to activate other links as we're scrolling to this one's section).
        $this.addClass("active").addClass("active-locked");
      })
      .each(function () {
        var $this = $(this),
          id = $this.attr("href"),
          $section = $(id);

        // No section for this link? Bail.
        if ($section.length < 1) return;

        // Scrollex.
        $section.scrollex({
          mode: "middle",
          top: "-20vh",
          bottom: "-20vh",
          initialize: function () {
            // Deactivate section.
            $section.addClass("inactive");
          },
          enter: function () {
            // Activate section.
            $section.removeClass("inactive");

            // No locked links? Deactivate all links and activate this section's one.
            if ($sidebar_a.filter(".active-locked").length == 0) {
              $sidebar_a.removeClass("active");
              $this.addClass("active");
            }

            // Otherwise, if this section's link is the one that's locked, unlock it.
            else if ($this.hasClass("active-locked"))
              $this.removeClass("active-locked");
          },
        });
      });
  }

  // Scrolly.
  $(".scrolly").scrolly({
    speed: 1000,
    offset: function () {
      // If <=large, >small, and sidebar is present, use its height as the offset.
      if (
        breakpoints.active("<=large") &&
        !breakpoints.active("<=small") &&
        $sidebar.length > 0
      )
        return $sidebar.height();

      return 0;
    },
  });

  // Spotlights.
  $(".spotlights > section")
    .scrollex({
      mode: "middle",
      top: "-10vh",
      bottom: "-10vh",
      initialize: function () {
        // Deactivate section.
        $(this).addClass("inactive");
      },
      enter: function () {
        // Activate section.
        $(this).removeClass("inactive");
      },
    })
    .each(function () {
      var $this = $(this),
        $image = $this.find(".image"),
        $img = $image.find("img"),
        x;

      // Assign image.
      $image.css("background-image", "url(" + $img.attr("src") + ")");

      // Set background position.
      if ((x = $img.data("position"))) $image.css("background-position", x);

      // Hide <img>.
      $img.hide();
    });

  // Features.
  $(".features").scrollex({
    mode: "middle",
    top: "-20vh",
    bottom: "-20vh",
    initialize: function () {
      // Deactivate section.
      $(this).addClass("inactive");
    },
    enter: function () {
      // Activate section.
      $(this).removeClass("inactive");
    },
  });
})(jQuery);
