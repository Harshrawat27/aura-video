// Function to initialize the YouTube shorts viewer with DOM observation
function initYouTubeShortsViewer() {
  // Get the user agent string
  const userAgent = navigator.userAgent.toLowerCase();

  // Function to check if the device is an iPhone
  function isIPhone() {
    return /iphone/.test(userAgent);
  }

  // Function to check if the browser is Safari
  function isSafari() {
    return /safari/.test(userAgent) && !/chrome/.test(userAgent);
  }

  // Function to check if the browser is Chrome
  function isChrome() {
    return /chrome/.test(userAgent);
  }

  // Function to check if the device is Android
  function isAndroid() {
    return /android/.test(userAgent);
  }

  // Function to check if the platform is Windows
  function isWindows() {
    return /windows/.test(userAgent);
  }

  // Function to organize and setup videos
  function setupVideos() {
    // Get all original videos and headings
    const originalVideos = Array.from(
      document.querySelectorAll('.youtube-short')
    );
    const headings = document.querySelectorAll('.youtube-heading');
    const shortsWrapper = document.querySelector('.youtube-shorts-wrapper');

    // Reset current state
    currentIndex = 0;
    isScrolling = false;
    scrollDirection = null;
    isVideoPlaying = true;

    console.log('Videos found:', originalVideos.length);
    console.log('Headings found:', headings.length);

    // Create a mapping of videos for each tag
    videos = [];
    const headingTags = Array.from(headings).map((heading) =>
      heading.textContent.trim()
    );

    // Create an object to track videos per tag for counting
    const videosPerTag = {};
    headingTags.forEach((tag) => {
      videosPerTag[tag] = 0;
    });

    // Create duplicate videos for each tag they belong to
    headingTags.forEach((tag) => {
      originalVideos.forEach((video, originalIndex) => {
        // Find all tag names within this video
        const tagElements = video.querySelectorAll('.tag-name');
        const videoTags = Array.from(tagElements).map((tagElem) =>
          tagElem.textContent.trim()
        );

        // If this video has the current tag, add it to our videos array
        if (videoTags.includes(tag)) {
          // Clone the video element
          const clonedVideo = video.cloneNode(true);

          // Increment the count for this tag
          videosPerTag[tag]++;

          // Store the original index, tag information, and position within this tag
          clonedVideo.dataset.originalIndex = originalIndex;
          clonedVideo.dataset.tag = tag;
          clonedVideo.dataset.tagPosition = videosPerTag[tag];

          videos.push(clonedVideo);
        }
      });
    });

    // Sort videos based on tag order
    videos.sort((a, b) => {
      const tagA = a.dataset.tag;
      const tagB = b.dataset.tag;
      const indexA = headingTags.indexOf(tagA);
      const indexB = headingTags.indexOf(tagB);
      return indexA - indexB;
    });

    // Replace original videos with our new organized list
    // First, clear the shorts wrapper
    while (shortsWrapper.firstChild) {
      shortsWrapper.removeChild(shortsWrapper.firstChild);
    }

    // Then add our new organized videos
    videos.forEach((video) => {
      shortsWrapper.appendChild(video);
    });

    // Setup all videos with event handlers and positioning
    setupVideoElements();

    // Show the first video initially if videos exist
    if (videos.length > 0) {
      videos[0].classList.add('active');
      videos[0].style.zIndex = '1';
      const initialTag = videos[0].dataset.tag;

      headings.forEach((heading) => {
        if (heading.textContent.trim() === initialTag) {
          heading.classList.add('active');
        }
      });

      const firstIframe = videos[0].querySelector('iframe');
      if (firstIframe) {
        // First completely remove the iframe and create a new one
        // This is the most reliable way to force autoplay
        const parent = firstIframe.parentNode;
        const originalSrc = firstIframe.getAttribute('src');

        // Create a new iframe element
        const newIframe = document.createElement('iframe');

        // Copy all attributes except src
        for (let i = 0; i < firstIframe.attributes.length; i++) {
          const attr = firstIframe.attributes[i];
          if (attr.name !== 'src') {
            newIframe.setAttribute(attr.name, attr.value);
          }
        }

        // Force autoplay on
        const modifiedSrc = getModifiedSrc(originalSrc, true);
        newIframe.src = modifiedSrc;

        // Replace the old iframe
        parent.replaceChild(newIframe, firstIframe);
        isVideoPlaying = true;

        // For YouTube to register the autoplay, add a click event automatically after load
        setTimeout(() => {
          try {
            newIframe.contentWindow.postMessage(
              '{"event":"command","func":"playVideo","args":""}',
              '*'
            );
          } catch (e) {
            console.error('Error forcing play on first video:', e);
          }
        }, 500);
      }

      // Initial sticky info update
      updateStickyInfo(0);
      // Prepare adjacent videos
      prepareAdjacentVideos(0);
    }

    // Re-add click events to headings
    addHeadingClickEvents();
  }

  // Function to add click events to headings
  function addHeadingClickEvents() {
    const headings = document.querySelectorAll('.youtube-heading');
    headings.forEach((heading) => {
      heading.addEventListener('click', () => {
        const targetTag = heading.textContent.trim();
        // Find the first video with the matching tag
        const targetVideoIndex = videos.findIndex(
          (video) => video.dataset.tag === targetTag
        );
        if (targetVideoIndex !== -1) {
          const direction = targetVideoIndex > currentIndex ? 'down' : 'up';
          showVideo(targetVideoIndex, direction);
        }
      });
    });
  }

  // Create MutationObserver to watch for changes to headings
  const headingsObserver = new MutationObserver((mutations) => {
    let headingsChanged = false;

    mutations.forEach((mutation) => {
      // Check if we're observing the parent of .youtube-heading elements
      if (mutation.type === 'childList') {
        // Check if any added or removed nodes contain .youtube-heading
        const addedHeadings = Array.from(mutation.addedNodes).some(
          (node) =>
            node.nodeType === 1 &&
            (node.classList?.contains('youtube-heading') ||
              node.querySelector?.('.youtube-heading'))
        );

        const removedHeadings = Array.from(mutation.removedNodes).some(
          (node) =>
            node.nodeType === 1 &&
            (node.classList?.contains('youtube-heading') ||
              node.querySelector?.('.youtube-heading'))
        );

        if (addedHeadings || removedHeadings) {
          headingsChanged = true;
        }
      }
    });

    // If headings have changed, re-setup the videos
    if (headingsChanged) {
      console.log('Headings changed, reconfiguring videos...');
      setupVideos();
    }
  });

  // Rest of the code remains the same as your original implementation
  let videos = [];
  let currentIndex = 0;
  let isScrolling = false;
  let scrollDirection = null;
  let isVideoPlaying = true;

  // Function to modify iframe src to include parameters
  function getModifiedSrc(src, autoplay) {
    let newSrc = src;

    // Make sure we have the enablejsapi parameter
    if (newSrc.indexOf('enablejsapi=1') === -1) {
      newSrc = newSrc.includes('?')
        ? newSrc + '&enablejsapi=1'
        : newSrc + '?enablejsapi=1';
    }

    // Always show controls
    if (newSrc.indexOf('controls=') !== -1) {
      newSrc = newSrc.replace(/controls=\d/g, 'controls=1');
    } else {
      newSrc = newSrc.includes('?')
        ? newSrc + '&controls=1'
        : newSrc + '?controls=1';
    }

    // IMPORTANT: Always force the autoplay parameter to the requested value
    // This will override any existing autoplay parameter in the original URL
    if (newSrc.indexOf('autoplay=') !== -1) {
      newSrc = newSrc.replace(
        /autoplay=\d/g,
        `autoplay=${autoplay ? '1' : '0'}`
      );
    } else {
      newSrc = newSrc.includes('?')
        ? newSrc + `&autoplay=${autoplay ? '1' : '0'}`
        : newSrc + `?autoplay=${autoplay ? '1' : '0'}`;
    }

    // Add playsinline
    if (newSrc.indexOf('playsinline=') === -1) {
      newSrc = newSrc.includes('?')
        ? newSrc + '&playsinline=1'
        : newSrc + '?playsinline=1';
    }

    // Set rel parameter
    if (newSrc.indexOf('rel=') === -1) {
      newSrc = newSrc.includes('?') ? newSrc + '&rel=0' : newSrc + '?rel=0';
    }

    return newSrc;
  }

  // Function to toggle play/pause the current video
  function togglePlayPause() {
    const currentVideo = videos[currentIndex];
    const iframe = currentVideo.querySelector('iframe');

    if (iframe) {
      try {
        if (isVideoPlaying) {
          iframe.contentWindow.postMessage(
            '{"event":"command","func":"pauseVideo","args":""}',
            '*'
          );
          isVideoPlaying = false;
        } else {
          iframe.contentWindow.postMessage(
            '{"event":"command","func":"playVideo","args":""}',
            '*'
          );
          isVideoPlaying = true;
        }
      } catch (e) {
        console.error('Error toggling play/pause:', e);

        // Fallback method
        if (!isVideoPlaying) {
          const currentSrc = iframe.src;
          iframe.src = getModifiedSrc(currentSrc, true);
          isVideoPlaying = true;
        } else {
          const currentSrc = iframe.src;
          iframe.src = getModifiedSrc(currentSrc, false);
          isVideoPlaying = false;
        }
      }
    }
  }

  // Function to pause the current video
  function pauseCurrentVideo() {
    if (!isVideoPlaying) return; // Already paused

    const currentVideo = videos[currentIndex];
    const iframe = currentVideo.querySelector('iframe');

    if (iframe) {
      try {
        iframe.contentWindow.postMessage(
          '{"event":"command","func":"pauseVideo","args":""}',
          '*'
        );
        isVideoPlaying = false;
      } catch (e) {
        console.error('Error pausing video:', e);

        // Fallback method
        const currentSrc = iframe.src;
        iframe.src = getModifiedSrc(currentSrc, false);
        isVideoPlaying = false;
      }
    }
  }

  // Function to prepare adjacent videos
  function prepareAdjacentVideos(currentIdx) {
    const prevIdx = (currentIdx - 1 + videos.length) % videos.length;
    const nextIdx = (currentIdx + 1) % videos.length;

    const prevIframe = videos[prevIdx].querySelector('iframe');
    if (prevIframe && !prevIframe.src.includes('enablejsapi=1')) {
      prevIframe.src = getModifiedSrc(prevIframe.src, false);
    }

    const nextIframe = videos[nextIdx].querySelector('iframe');
    if (nextIframe && !nextIframe.src.includes('enablejsapi=1')) {
      nextIframe.src = getModifiedSrc(nextIframe.src, false);
    }
  }

  // Function to show a specific video
  function showVideo(index, direction) {
    if (isScrolling || index === currentIndex) return;
    isScrolling = true;
    scrollDirection = direction;

    // Update headings based on the target video's tag
    const targetTag = videos[index].dataset.tag;
    const headings = document.querySelectorAll('.youtube-heading');
    headings.forEach((heading) => {
      if (heading.textContent.trim() === targetTag) {
        heading.classList.add('active');
      } else {
        heading.classList.remove('active');
      }
    });

    // Optionally, scroll the active heading into view
    headings.forEach((heading) => {
      if (heading.textContent.trim() === targetTag) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // Update sticky elements with current information
    updateStickyInfo(index);

    const currentVideo = videos[currentIndex];
    const targetVideo = videos[index];

    // Set transitions for smooth animation
    currentVideo.style.transition = 'transform 0.5s ease-out';
    targetVideo.style.transition = 'transform 0.5s ease-out';

    if (direction === 'up') {
      targetVideo.style.transform = 'translateY(-100%)';
      setTimeout(() => {
        currentVideo.style.transform = 'translateY(100%)';
        targetVideo.style.transform = 'translateY(0)';
      }, 50);
    } else {
      targetVideo.style.transform = 'translateY(100%)';
      setTimeout(() => {
        currentVideo.style.transform = 'translateY(-100%)';
        targetVideo.style.transform = 'translateY(0)';
      }, 50);
    }

    // Reset other videos
    videos.forEach((video) => {
      if (video !== currentVideo && video !== targetVideo) {
        video.classList.remove('active');
        video.style.transform = '';
        video.style.zIndex = '0';
      }
    });

    // Set active classes and z-index
    currentVideo.classList.add('active');
    targetVideo.classList.add('active');
    currentVideo.style.zIndex = '1';
    targetVideo.style.zIndex = '2';

    // Pause the current video
    const currentIframe = currentVideo.querySelector('iframe');
    if (currentIframe) {
      try {
        currentIframe.contentWindow.postMessage(
          '{"event":"command","func":"pauseVideo","args":""}',
          '*'
        );
      } catch (e) {
        console.error('Error pausing current video:', e);
        currentIframe.src = getModifiedSrc(currentIframe.src, false);
      }
    }

    // Setup and play the target video
    const targetIframe = targetVideo.querySelector('iframe');
    if (targetIframe) {
      // Use the complete replacement technique for reliable autoplay
      const parent = targetIframe.parentNode;
      const originalSrc = targetIframe.getAttribute('src');

      // Create a new iframe element
      const newIframe = document.createElement('iframe');

      // Copy all attributes except src
      for (let i = 0; i < targetIframe.attributes.length; i++) {
        const attr = targetIframe.attributes[i];
        if (attr.name !== 'src') {
          newIframe.setAttribute(attr.name, attr.value);
        }
      }

      // Force autoplay on
      const modifiedSrc = getModifiedSrc(originalSrc, true);
      newIframe.src = modifiedSrc;

      // Replace the old iframe
      parent.replaceChild(newIframe, targetIframe);
      isVideoPlaying = true;

      // Force play after a short delay
      setTimeout(() => {
        try {
          newIframe.contentWindow.postMessage(
            '{"event":"command","func":"playVideo","args":""}',
            '*'
          );
        } catch (e) {
          console.error('Error forcing play on video:', e);
        }
      }, 300);
    }

    // Update current index and prepare adjacent videos
    currentIndex = index;
    prepareAdjacentVideos(currentIndex);

    // Reset everything after animation completes
    setTimeout(() => {
      isScrolling = false;
      videos.forEach((video, idx) => {
        if (idx !== currentIndex) {
          video.classList.remove('active');
          video.style.transform = '';
          video.style.zIndex = '0';
        }
      });
      currentVideo.style.transition = '';
      targetVideo.style.transition = '';
    }, 500);
  }

  // Function to restart the current category from its first video
  function restartCurrentCategory() {
    const currentVideo = videos[currentIndex];
    const currentTag = currentVideo.dataset.tag;

    // Find the first video with the current tag
    const firstVideoIndex = videos.findIndex(
      (video) =>
        video.dataset.tag === currentTag && video.dataset.tagPosition === '1'
    );

    if (firstVideoIndex !== -1 && firstVideoIndex !== currentIndex) {
      // Determine the scroll direction based on position
      const direction = firstVideoIndex > currentIndex ? 'down' : 'up';
      showVideo(firstVideoIndex, direction);
    }
  }

  // Function to update sticky information elements
  function updateStickyInfo(index) {
    if (index >= videos.length) return;

    const currentVideo = videos[index];
    const currentTag = currentVideo.dataset.tag;
    const currentPosition = currentVideo.dataset.tagPosition;

    // Get total videos in this tag by counting
    let totalVideosInTag = 0;
    videos.forEach((video) => {
      if (video.dataset.tag === currentTag) {
        totalVideosInTag++;
      }
    });

    // Update the style-name (tag name)
    const styleNameElement = document.querySelector('.style-name');
    if (styleNameElement) {
      styleNameElement.textContent = currentTag;
    }

    // Update current video number
    const currentVideoElement = document.querySelector('.current-video');
    if (currentVideoElement) {
      currentVideoElement.textContent = parseInt(currentPosition) - 1;
    }

    // Update total videos in this tag
    const totalVideosElement = document.querySelector('.total-videos');
    if (totalVideosElement) {
      const totalVideoNumber = totalVideosInTag - 1;
      totalVideosElement.textContent = totalVideoNumber;
    }
  }

  // Improved wheel handler with debounce
  let wheelTimer;
  function handleWheel(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const controlAreaHeight = rect.height * 0.15;
    const clickY = event.clientY - rect.top;

    // Don't handle wheel events in the control area
    if (clickY > rect.height - controlAreaHeight) return;

    event.preventDefault();

    // Clear previous timer (debounce)
    clearTimeout(wheelTimer);

    // Set a new timer
    wheelTimer = setTimeout(() => {
      if (!isScrolling) {
        if (event.deltaY > 0) {
          const nextIndex = (currentIndex + 1) % videos.length;
          showVideo(nextIndex, 'down');
        } else {
          const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
          showVideo(prevIndex, 'up');
        }

        // Force play current video if it's not playing
        if (!isVideoPlaying) {
          const currentVideo = videos[currentIndex];
          const iframe = currentVideo.querySelector('iframe');
          if (iframe) {
            // Replace iframe for reliable autoplay
            const parent = iframe.parentNode;
            const originalSrc = iframe.getAttribute('src');

            const newIframe = document.createElement('iframe');
            for (let i = 0; i < iframe.attributes.length; i++) {
              const attr = iframe.attributes[i];
              if (attr.name !== 'src') {
                newIframe.setAttribute(attr.name, attr.value);
              }
            }

            newIframe.src = getModifiedSrc(originalSrc, true);
            parent.replaceChild(newIframe, iframe);
            isVideoPlaying = true;

            setTimeout(() => {
              try {
                newIframe.contentWindow.postMessage(
                  '{"event":"command","func":"playVideo","args":""}',
                  '*'
                );
              } catch (e) {
                console.error('Error forcing play:', e);
              }
            }, 300);
          }
        }
      }
    }, 100);
  }

  // Touch handling variables
  let touchStartY = 0,
    touchStartX = 0;
  let isTouchingControls = false;
  let touchStartTime = 0;
  let lastTouchEnd = 0;

  // Handle touch start
  function handleTouchStart(event) {
    touchStartY = event.touches[0].clientY;
    touchStartX = event.touches[0].clientX;
    touchStartTime = new Date().getTime();

    const rect = event.currentTarget.getBoundingClientRect();
    const controlAreaHeight = rect.height * 0.15;
    const touchY = touchStartY - rect.top;

    // Check if touch is in control area
    isTouchingControls = touchY > rect.height - controlAreaHeight;
  }

  // Handle touch move (prevent scrolling if not in controls)
  function handleTouchMove(event) {
    if (!isTouchingControls) {
      event.preventDefault();
    }
  }

  // Handle touch end
  function handleTouchEnd(event) {
    const touchEndTime = new Date().getTime();
    const touchEndY = event.changedTouches[0].clientY;
    const touchEndX = event.changedTouches[0].clientX;
    const diffY = touchStartY - touchEndY;
    const diffX = touchStartX - touchEndX;
    const touchDuration = touchEndTime - touchStartTime;

    // Prevent double-firing
    const timeSinceLastTouch = touchEndTime - lastTouchEnd;
    lastTouchEnd = touchEndTime;

    if (timeSinceLastTouch < 300) {
      return;
    }

    // If touching controls, ignore swipe
    if (isTouchingControls) return;

    // Detect tap (for play/pause)
    if (touchDuration < 300 && Math.abs(diffY) < 10 && Math.abs(diffX) < 10) {
      togglePlayPause();
      return;
    }

    // Detect swipe
    const swipeThreshold = 50;
    if (
      Math.abs(diffY) > Math.abs(diffX) &&
      Math.abs(diffY) > swipeThreshold &&
      !isScrolling
    ) {
      if (diffY > 0) {
        // Swipe up
        const nextIndex = (currentIndex + 1) % videos.length;
        showVideo(nextIndex, 'down');
      } else {
        // Swipe down
        const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
        showVideo(prevIndex, 'up');
      }

      // Force play current video if it's not playing
      if (!isVideoPlaying) {
        const currentVideo = videos[currentIndex];
        const iframe = currentVideo.querySelector('iframe');
        if (iframe) {
          // Same iframe replacement technique
          const parent = iframe.parentNode;
          const originalSrc = iframe.getAttribute('src');

          const newIframe = document.createElement('iframe');
          for (let i = 0; i < iframe.attributes.length; i++) {
            const attr = iframe.attributes[i];
            if (attr.name !== 'src') {
              newIframe.setAttribute(attr.name, attr.value);
            }
          }

          newIframe.src = getModifiedSrc(originalSrc, true);
          parent.replaceChild(newIframe, iframe);
          isVideoPlaying = true;

          setTimeout(() => {
            try {
              newIframe.contentWindow.postMessage(
                '{"event":"command","func":"playVideo","args":""}',
                '*'
              );
            } catch (e) {
              console.error('Error forcing play:', e);
            }
          }, 300);
        }
      }
    }
  }

  // Function to setup video elements
  function setupVideoElements() {
    // Setup all videos
    videos.forEach((video) => {
      // Position absolutely
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.zIndex = '0';

      // Create top navigation zone
      const topZone = document.createElement('div');
      topZone.className = 'navigation-zone top-zone';
      topZone.style.position = 'absolute';
      topZone.style.top = '0';
      topZone.style.left = '0';
      topZone.style.width = '100%';
      topZone.style.height = '45%';
      topZone.style.zIndex = '3';

      // Create bottom navigation zone
      const bottomZone = document.createElement('div');
      bottomZone.className = 'navigation-zone bottom-zone';
      bottomZone.style.position = 'absolute';
      bottomZone.style.bottom = '15%';
      bottomZone.style.left = '0';
      bottomZone.style.width = '100%';
      bottomZone.style.height = '40%';
      bottomZone.style.zIndex = '3';

      // Add events to both zones
      [topZone, bottomZone].forEach((zone) => {
        // Use click for play/pause
        zone.addEventListener('click', () => {
          if (!isScrolling) togglePlayPause();
        });

        zone.addEventListener('wheel', handleWheel);

        // Add touch events with the same handlers as the main wrapper
        zone.addEventListener('touchstart', handleTouchStart, {
          passive: false,
        });
        zone.addEventListener('touchmove', handleTouchMove, { passive: false });
        zone.addEventListener('touchend', handleTouchEnd);

        zone.style.pointerEvents = 'auto';
        zone.style.background = 'transparent';
        video.appendChild(zone);
      });

      // Modify iframe src
      const iframe = video.querySelector('iframe');
      if (iframe) {
        iframe.src = getModifiedSrc(iframe.src, false);
      }
    });

    // Setup event listeners
    setupEventListeners();
  }

  // Function to setup all event listeners
  function setupEventListeners() {
    const shortsWrapper = document.querySelector('.youtube-shorts-wrapper');

    // Add event listeners to shorts wrapper
    shortsWrapper.addEventListener('wheel', handleWheel);

    // Standard touch event handling
    shortsWrapper.addEventListener('touchstart', handleTouchStart, {
      passive: false,
    });
    shortsWrapper.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    });
    shortsWrapper.addEventListener('touchend', handleTouchEnd);

    // Add event listeners to custom navigation buttons
    const prevButton = document.querySelector('.prev-button');
    if (prevButton) {
      prevButton.addEventListener('click', () => {
        const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
        showVideo(prevIndex, 'up');
      });
    }

    const nextButton = document.querySelector('.next-button');
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        const nextIndex = (currentIndex + 1) % videos.length;
        showVideo(nextIndex, 'down');
      });
    }

    const playPauseButton = document.querySelector('.play-pause-button');
    if (playPauseButton) {
      playPauseButton.addEventListener('click', () => {
        togglePlayPause();
      });
    }

    // Add click event to the shut-down element
    const shutDownElement = document.querySelector('.shut-down');
    if (shutDownElement) {
      shutDownElement.addEventListener('click', restartCurrentCategory);
    }

    // Add click event to back button elements
    const backButtons = document.querySelectorAll('.back-btn');
    if (backButtons.length > 0) {
      backButtons.forEach((button) => {
        button.addEventListener('click', pauseCurrentVideo);
      });
    }
  }

  // Add styles for navigation zones and other elements
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .navigation-zone {
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
        }
        .shut-down {
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
        }
        .back-btn {
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
        }
      `;
    document.head.appendChild(style);
  }

  // Start observing changes to headings container
  function startObserving() {
    // Find a good parent element that contains the headings
    const headingsContainer =
      document.querySelector('.youtube-heading')?.parentNode;

    if (headingsContainer) {
      // Configure observer to watch for child list changes (adding/removing nodes)
      const config = { childList: true, subtree: true };
      headingsObserver.observe(headingsContainer, config);
      console.log('Now observing changes to headings container');
    } else {
      console.warn('Could not find headings container to observe');
    }
  }

  // Add keyboard controls
  function setupKeyboardControls() {
    document.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
        showVideo(prevIndex, 'up');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % videos.length;
        showVideo(nextIndex, 'down');
      } else if (event.key === ' ' || event.key === 'k') {
        event.preventDefault();
        togglePlayPause();
      }
    });
  }

  // Initialize everything based on browser/device
  if (isChrome() || isWindows() || isAndroid()) {
    document.addEventListener('DOMContentLoaded', function () {
      console.log(
        'Initializing YouTube Shorts Viewer for Chrome/Windows/Android'
      );
      setupVideos();
      addStyles();
      setupKeyboardControls();
      startObserving();
    });
  } else if (isSafari() || isIPhone()) {
    document.addEventListener('DOMContentLoaded', function () {
      console.log('Initializing YouTube Shorts Viewer for Safari/iOS');
      initSafariVersion();
      startObserving();
    });
  } else {
    // Fallback for other browsers/devices
    document.addEventListener('DOMContentLoaded', function () {
      console.log('Unknown browser or device - using fallback');
      setupFallbackVersion();
      startObserving();
    });
  }

  // Start observing changes to headings container
  function startObserving() {
    // Find a good parent element that contains the headings
    const headingsContainer =
      document.querySelector('.youtube-heading')?.parentNode;

    if (headingsContainer) {
      // Configure observer to watch for child list changes (adding/removing nodes)
      const config = { childList: true, subtree: true };
      headingsObserver.observe(headingsContainer, config);
      console.log('Now observing changes to headings container');
    } else {
      console.warn('Could not find headings container to observe');

      // Try again after a short delay in case DOM is still loading
      setTimeout(() => {
        const retryContainer =
          document.querySelector('.youtube-heading')?.parentNode;
        if (retryContainer) {
          const config = { childList: true, subtree: true };
          headingsObserver.observe(retryContainer, config);
          console.log(
            'Now observing changes to headings container (retry successful)'
          );
        }
      }, 1000);
    }
  }

  // Function to handle Safari/iOS-specific implementation
  function initSafariVersion() {
    // Core variables for Safari/iOS
    let safariVideos = [];
    let safariCurrentIndex = 0;
    let safariIsScrolling = false;
    let safariIsVideoPlaying = false;

    // Detect iOS devices
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    setupSafariVideos();

    // Function to setup videos for Safari/iOS
    function setupSafariVideos() {
      const originalVideos = Array.from(
        document.querySelectorAll('.youtube-short')
      );
      const headings = document.querySelectorAll('.youtube-heading');
      const shortsWrapper = document.querySelector('.youtube-shorts-wrapper');

      // Reset Safari-specific variables
      safariCurrentIndex = 0;
      safariIsScrolling = false;
      safariIsVideoPlaying = false;

      console.log('Videos found for Safari/iOS:', originalVideos.length);

      // Create video mapping based on tags
      const headingTags = Array.from(headings).map((heading) =>
        heading.textContent.trim()
      );

      // Reset the videos array
      safariVideos = [];

      const videosPerTag = {};
      headingTags.forEach((tag) => {
        videosPerTag[tag] = 0;
      });

      // Organize videos by tag
      headingTags.forEach((tag) => {
        originalVideos.forEach((video, originalIndex) => {
          const tagElements = video.querySelectorAll('.tag-name');
          const videoTags = Array.from(tagElements).map((tagElem) =>
            tagElem.textContent.trim()
          );

          if (videoTags.includes(tag)) {
            const clonedVideo = video.cloneNode(true);
            videosPerTag[tag]++;

            clonedVideo.dataset.originalIndex = originalIndex;
            clonedVideo.dataset.tag = tag;
            clonedVideo.dataset.tagPosition = videosPerTag[tag];

            safariVideos.push(clonedVideo);
          }
        });
      });

      // Sort videos based on tag order
      safariVideos.sort((a, b) => {
        const indexA = headingTags.indexOf(a.dataset.tag);
        const indexB = headingTags.indexOf(b.dataset.tag);
        return indexA - indexB;
      });

      // Clear and rebuild the shorts wrapper
      while (shortsWrapper.firstChild) {
        shortsWrapper.removeChild(shortsWrapper.firstChild);
      }

      safariVideos.forEach((video) => {
        shortsWrapper.appendChild(video);
      });

      // Setup all the video elements for Safari/iOS
      setupSafariVideoElements();

      // Add click events to headings
      setupSafariHeadingEvents();

      // Initialize first video
      if (safariVideos.length > 0) {
        safariVideos[0].classList.add('active');
        safariVideos[0].style.zIndex = '1';

        const initialTag = safariVideos[0].dataset.tag;
        headings.forEach((heading) => {
          if (heading.textContent.trim() === initialTag) {
            heading.classList.add('active');
          }
        });

        updateSafariStickyInfo(0);
      }
    }

    // Safari touch handling
    let touchStartY = 0;
    let touchStartTime = 0;
    let lastTouchTime = 0;

    function handleSafariTouchStart(e) {
      // Store touch coordinates and time
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }

    function handleSafariTouchEnd(e) {
      if (safariIsScrolling) return;

      const now = Date.now();
      if (now - lastTouchTime < 500) {
        // Ignore touch events that come too quickly after the previous one
        return;
      }

      const touchEndY = e.changedTouches[0].clientY;
      const touchDuration = now - touchStartTime;
      const diffY = touchStartY - touchEndY;

      // Only handle swipes, not taps
      if (Math.abs(diffY) > 50 && touchDuration < 500) {
        if (diffY > 0) {
          // Swipe up - next video
          const nextIndex = (safariCurrentIndex + 1) % safariVideos.length;
          showSafariVideo(nextIndex, 'down');
        } else {
          // Swipe down - previous video
          const prevIndex =
            (safariCurrentIndex - 1 + safariVideos.length) %
            safariVideos.length;
          showSafariVideo(prevIndex, 'up');
        }
        lastTouchTime = now;
      }
    }

    // Rest of Safari implementation...
  }

  // Function to set up a fallback for unsupported browsers
  function setupFallbackVersion() {
    console.log('Setting up fallback version for unsupported browser');

    // Apply basic styling and functionality for other browsers
    const shortsWrapper = document.querySelector('.youtube-shorts-wrapper');
    const originalVideos = document.querySelectorAll('.youtube-short');

    if (shortsWrapper && originalVideos.length > 0) {
      // Apply basic styling to make videos visible
      shortsWrapper.style.position = 'relative';
      shortsWrapper.style.overflow = 'auto';
      shortsWrapper.style.maxHeight = '80vh';

      // Make all videos visible in a scrollable list
      originalVideos.forEach((video) => {
        video.style.position = 'relative';
        video.style.display = 'block';
        video.style.width = '100%';
        video.style.margin = '10px 0';

        // Make sure videos are visible
        const iframe = video.querySelector('iframe');
        if (iframe) {
          iframe.style.width = '100%';
          iframe.style.height = '56.25vw'; // 16:9 aspect ratio
          iframe.style.maxHeight = '80vh';

          // Add enablejsapi parameter
          if (!iframe.src.includes('enablejsapi=1')) {
            const url = new URL(iframe.src);
            url.searchParams.set('enablejsapi', '1');
            iframe.src = url.toString();
          }
        }
      });

      // Add basic click functionality to headings
      const headings = document.querySelectorAll('.youtube-heading');
      headings.forEach((heading) => {
        heading.style.cursor = 'pointer';
        heading.addEventListener('click', function () {
          const headingText = this.textContent.trim();

          // Find the first video with this tag
          for (const video of originalVideos) {
            const tagElements = video.querySelectorAll('.tag-name');
            const videoTags = Array.from(tagElements).map((tag) =>
              tag.textContent.trim()
            );

            if (videoTags.includes(headingText)) {
              // Scroll to this video
              video.scrollIntoView({ behavior: 'smooth', block: 'start' });
              break;
            }
          }
        });
      });
    }
  }
}

// Initialize the viewer
initYouTubeShortsViewer();
