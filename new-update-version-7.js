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

// Main conditional logic
if (isChrome() || isWindows() || isAndroid()) {
  document.addEventListener('DOMContentLoaded', function () {
    // Global variables that need to be accessible across functions
    let videos = [];
    let videosPerTag = {};
    let currentIndex = 0;
    let isScrolling = false;
    let scrollDirection = null;
    let isVideoPlaying = true;

    // Listen for filter changes
    document.addEventListener('videoListChanged', function (event) {
      console.log('Video list changed, rebuilding...', event.detail);
      refreshVideoList();
    });

    // Global function that can be called by filter script
    window.refreshVideoList = function () {
      console.log('Refreshing video list...');

      // Re-setup videos with current DOM state
      const setupResult = setupVideos();
      videos = setupResult.videos;
      videosPerTag = setupResult.videosPerTag;

      // Rebuild the video display
      rebuildVideoDisplay();

      console.log('Video list refreshed. New video count:', videos.length);
    };

    // Get all original videos and headings
    const originalVideos = Array.from(
      document.querySelectorAll('.youtube-short')
    );
    const headings = document.querySelectorAll('.youtube-heading');
    const shortsWrapper = document.querySelector('.youtube-shorts-wrapper');

    console.log('Videos found:', originalVideos.length);
    console.log('Headings found:', headings.length);

    // Function to setup videos - can be called multiple times
    function setupVideos() {
      // Get current videos and headings from DOM (they may have changed due to filtering)
      const currentOriginalVideos = Array.from(
        document.querySelectorAll('.youtube-short')
      );
      const currentHeadings = document.querySelectorAll('.youtube-heading');

      // Reset arrays
      const newVideos = [];
      const headingTags = Array.from(currentHeadings).map((heading) =>
        heading.textContent.trim()
      );

      // Create an object to track videos per tag for counting
      const newVideosPerTag = {};
      headingTags.forEach((tag) => {
        newVideosPerTag[tag] = 0;
      });

      // Create direct mapping - each heading gets one video
      headingTags.forEach((tag, tagIndex) => {
        if (currentOriginalVideos[tagIndex]) {
          const video = currentOriginalVideos[tagIndex];
          const clonedVideo = video.cloneNode(true);

          clonedVideo.dataset.originalIndex = tagIndex;
          clonedVideo.dataset.tag = tag;
          clonedVideo.dataset.tagPosition = 1; // Always 1 since no duplicates

          newVideos.push(clonedVideo);
          newVideosPerTag[tag] = 1; // Always 1 video per heading
        }
      });

      return { videos: newVideos, videosPerTag: newVideosPerTag, headingTags };
    }

    function getModifiedSrc(originalSrc, autoplay) {
      if (!originalSrc) return originalSrc;

      console.log('getModifiedSrc called:', { originalSrc, autoplay });

      let newSrc = originalSrc;

      // Add or update autoplay parameter
      if (newSrc.indexOf('autoplay=') !== -1) {
        newSrc = newSrc.replace(
          /autoplay=[01]/g,
          `autoplay=${autoplay ? '1' : '0'}`
        );
      } else {
        newSrc = newSrc.includes('?')
          ? newSrc + `&autoplay=${autoplay ? '1' : '0'}`
          : newSrc + `?autoplay=${autoplay ? '1' : '0'}`;
      }

      // Add enablejsapi if not present
      if (newSrc.indexOf('enablejsapi=') === -1) {
        newSrc = newSrc.includes('?')
          ? newSrc + '&enablejsapi=1'
          : newSrc + '?enablejsapi=1';
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

      console.log('getModifiedSrc result:', newSrc);
      return newSrc;
    }

    // Function to toggle play/pause the current video
    function togglePlayPause() {
      if (videos.length === 0) return;

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
      if (!isVideoPlaying || videos.length === 0) return; // Already paused

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
      if (videos.length === 0) return;

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
      if (isScrolling || index === currentIndex || videos.length === 0) return;
      isScrolling = true;
      scrollDirection = direction;

      // Update headings based on the target video's tag
      const targetTag = videos[index].dataset.tag;
      const currentHeadings = document.querySelectorAll('.youtube-heading');
      let activeHeadingSet = false;
      currentHeadings.forEach((heading) => {
        if (heading.textContent.trim() === targetTag && !activeHeadingSet) {
          heading.classList.add('active');
          activeHeadingSet = true; // Only activate the first matching heading
        } else {
          heading.classList.remove('active');
        }
      });

      // Optionally, scroll the active heading into view
      currentHeadings.forEach((heading) => {
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

    // Function to update sticky information elements
    function updateStickyInfo(index) {
      if (videos.length === 0 || index >= videos.length) return;

      const currentVideo = videos[index];
      const currentTag = currentVideo.dataset.tag;

      // Update the style-name (tag name)
      const styleNameElement = document.querySelector('.style-name');
      if (styleNameElement) {
        styleNameElement.textContent = currentTag;
      }

      // Update current video number (show actual video index)
      const currentVideoElement = document.querySelector('.current-video');
      if (currentVideoElement) {
        currentVideoElement.textContent = index + 1; // Direct index + 1
      }

      // Update total videos
      const totalVideosElement = document.querySelector('.total-videos');
      if (totalVideosElement) {
        totalVideosElement.textContent = videos.length;
      }
    }

    function rebuildVideoDisplay() {
      const shortsWrapper = document.querySelector('.youtube-shorts-wrapper');
      if (!shortsWrapper) return;

      // Reset iframe tracking when rebuilding
      iframeReplacementTracker = new WeakSet();

      // Sort videos based on tag order
      const currentHeadings = document.querySelectorAll('.youtube-heading');
      const headingTags = Array.from(currentHeadings).map((heading) =>
        heading.textContent.trim()
      );

      videos.sort((a, b) => {
        const tagA = a.dataset.tag;
        const tagB = b.dataset.tag;
        const indexA = headingTags.indexOf(tagA);
        const indexB = headingTags.indexOf(tagB);
        return indexA - indexB;
      });

      // Replace original videos with our new organized list
      while (shortsWrapper.firstChild) {
        shortsWrapper.removeChild(shortsWrapper.firstChild);
      }

      videos.forEach((video) => {
        shortsWrapper.appendChild(video);
      });

      // Reset video states
      currentIndex = 0;
      isScrolling = false;
      isVideoPlaying = true;

      // Setup video elements
      setupVideoElements();

      // Initialize first video
      initializeFirstVideo();
    }

    // Initial setup
    const setupResult = setupVideos();
    videos = setupResult.videos;
    videosPerTag = setupResult.videosPerTag;

    // Initial build
    rebuildVideoDisplay();

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
        if (!isScrolling && videos.length > 0) {
          if (event.deltaY > 0) {
            const nextIndex = (currentIndex + 1) % videos.length;
            showVideo(nextIndex, 'down');
          } else {
            const prevIndex =
              (currentIndex - 1 + videos.length) % videos.length;
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
        !isScrolling &&
        videos.length > 0
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
          zone.addEventListener('touchmove', handleTouchMove, {
            passive: false,
          });
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
    }

    // Add event listeners to shorts wrapper after it's confirmed to exist
    if (shortsWrapper) {
      shortsWrapper.addEventListener('wheel', handleWheel);

      // Standard touch event handling
      shortsWrapper.addEventListener('touchstart', handleTouchStart, {
        passive: false,
      });
      shortsWrapper.addEventListener('touchmove', handleTouchMove, {
        passive: false,
      });
      shortsWrapper.addEventListener('touchend', handleTouchEnd);
    }

    // Add styles for navigation zones and other elements
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

    // Add event listeners to custom navigation buttons
    const prevButton = document.querySelector('.prev-button');
    if (prevButton) {
      prevButton.addEventListener('click', () => {
        if (videos.length > 0) {
          const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
          showVideo(prevIndex, 'up');
        }
      });
    }

    const nextButton = document.querySelector('.next-button');
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        if (videos.length > 0) {
          const nextIndex = (currentIndex + 1) % videos.length;
          showVideo(nextIndex, 'down');
        }
      });
    }

    const playPauseButton = document.querySelector('.play-pause-button');
    if (playPauseButton) {
      playPauseButton.addEventListener('click', () => {
        togglePlayPause();
      });
    }

    // Add click event to back button elements
    const backButtons = document.querySelectorAll('.back-btn');
    if (backButtons.length > 0) {
      backButtons.forEach((button) => {
        button.addEventListener('click', pauseCurrentVideo);
      });
    }

    // Add click event to headings - exactly like in working version
    headings.forEach((heading) => {
      heading.addEventListener('click', () => {
        const targetTag = heading.textContent.trim();
        console.log('Heading clicked:', targetTag);
        console.log(
          'Current videos:',
          videos.map((v) => v.dataset.tag)
        );

        // Find the first video with the matching tag
        const targetVideoIndex = videos.findIndex(
          (video) => video.dataset.tag === targetTag
        );

        console.log('Target video index found:', targetVideoIndex);
        console.log('Current index:', currentIndex);

        if (targetVideoIndex !== -1) {
          const direction = targetVideoIndex > currentIndex ? 'down' : 'up';
          console.log('Moving:', direction);
          showVideo(targetVideoIndex, direction);
        } else {
          console.log('No video found for tag:', targetTag);
        }
      });
    });

    // Add keyboard controls
    document.addEventListener('keydown', function (event) {
      if (videos.length === 0) return;

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

    let iframeReplacementTracker = new WeakSet();

    // Function to initialize first video
    function initializeFirstVideo() {
      if (videos.length > 0) {
        videos[0].classList.add('active');
        videos[0].style.zIndex = '1';
        const initialTag = videos[0].dataset.tag;

        const currentHeadings = document.querySelectorAll('.youtube-heading');
        currentHeadings.forEach((heading) => {
          if (heading.textContent.trim() === initialTag) {
            heading.classList.add('active');
          }
        });

        const firstIframe = videos[0].querySelector('iframe');
        if (firstIframe && !iframeReplacementTracker.has(firstIframe)) {
          // Only replace iframe once per element
          const parent = firstIframe.parentNode;
          const originalSrc = firstIframe.getAttribute('src');

          const newIframe = document.createElement('iframe');

          // Copy all attributes except src
          for (let i = 0; i < firstIframe.attributes.length; i++) {
            const attr = firstIframe.attributes[i];
            if (attr.name !== 'src') {
              newIframe.setAttribute(attr.name, attr.value);
            }
          }

          const modifiedSrc = getModifiedSrc(originalSrc, true);
          newIframe.src = modifiedSrc;

          // Track that this iframe has been replaced
          iframeReplacementTracker.add(newIframe);

          parent.replaceChild(newIframe, firstIframe);
          isVideoPlaying = true;

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
        } else if (firstIframe) {
          // If iframe already replaced, just try to play it
          try {
            firstIframe.contentWindow.postMessage(
              '{"event":"command","func":"playVideo","args":""}',
              '*'
            );
            isVideoPlaying = true;
          } catch (e) {
            console.error('Error playing existing iframe:', e);
          }
        }

        updateStickyInfo(0);
      }
    }
  });
} else if (isSafari() || isIPhone()) {
  // Safari/iOS implementation (unchanged for now)
  document.addEventListener('DOMContentLoaded', function () {
    // Core variables
    let videos = [];
    let videosPerTag = {};
    let currentIndex = 0;
    let isScrolling = false;
    let isVideoPlaying = false;

    // Listen for filter changes in Safari section
    document.addEventListener('videoListChanged', function (event) {
      console.log('Safari: Video list changed, rebuilding...', event.detail);
      refreshSafariVideoList();
    });

    // Global function for Safari that can be called by filter script
    window.refreshSafariVideoList = function () {
      console.log('Safari: Refreshing video list...');

      // Re-setup videos with current DOM state
      const safariSetupResult = setupSafariVideos();
      videos = safariSetupResult.videos;
      videosPerTag = safariSetupResult.videosPerTag;

      // Rebuild the video display
      rebuildSafariVideoDisplay();

      console.log(
        'Safari: Video list refreshed. New video count:',
        videos.length
      );
    };

    const originalVideos = Array.from(
      document.querySelectorAll('.youtube-short')
    );
    const headings = document.querySelectorAll('.youtube-heading');
    const shortsWrapper = document.querySelector('.youtube-shorts-wrapper');

    // Detect iOS devices
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    console.log('iOS device detected:', isIOS);

    console.log('Videos found:', originalVideos.length);

    // Function to setup videos for Safari/iOS
    function setupSafariVideos() {
      const currentOriginalVideos = Array.from(
        document.querySelectorAll('.youtube-short')
      );
      const currentHeadings = document.querySelectorAll('.youtube-heading');

      // Reset arrays
      const newVideos = [];
      const headingTags = Array.from(currentHeadings).map((heading) =>
        heading.textContent.trim()
      );
      const newVideosPerTag = {};
      headingTags.forEach((tag) => {
        newVideosPerTag[tag] = 0;
      });

      // Create direct mapping - each heading gets one video
      headingTags.forEach((tag, tagIndex) => {
        if (currentOriginalVideos[tagIndex]) {
          const video = currentOriginalVideos[tagIndex];
          const clonedVideo = video.cloneNode(true);

          clonedVideo.dataset.originalIndex = tagIndex;
          clonedVideo.dataset.tag = tag;
          clonedVideo.dataset.tagPosition = 1; // Always 1 since no duplicates

          newVideos.push(clonedVideo);
          newVideosPerTag[tag] = 1; // Always 1 video per heading
        }
      });

      return { videos: newVideos, videosPerTag: newVideosPerTag, headingTags };
    }

    // Initial setup for Safari
    let safariSetupResult = setupSafariVideos();
    videos = safariSetupResult.videos;
    videosPerTag = safariSetupResult.videosPerTag;

    // Function to rebuild Safari video display
    function rebuildSafariVideoDisplay() {
      const shortsWrapper = document.querySelector('.youtube-shorts-wrapper');
      if (!shortsWrapper) return;

      const currentHeadings = document.querySelectorAll('.youtube-heading');
      const headingTags = Array.from(currentHeadings).map((heading) =>
        heading.textContent.trim()
      );

      // Sort videos based on tag order
      videos.sort((a, b) => {
        const indexA = headingTags.indexOf(a.dataset.tag);
        const indexB = headingTags.indexOf(b.dataset.tag);
        return indexA - indexB;
      });

      // Clear and rebuild the shorts wrapper
      while (shortsWrapper.firstChild) {
        shortsWrapper.removeChild(shortsWrapper.firstChild);
      }

      videos.forEach((video) => {
        shortsWrapper.appendChild(video);
      });

      // Reset Safari states
      currentIndex = 0;
      isScrolling = false;
      isVideoPlaying = false;

      // Setup Safari video elements
      setupSafariVideoElements();

      // Initialize first Safari video
      initializeSafariFirstVideo();
    }

    // Add click events to headings for Safari - exactly like in working version
    headings.forEach((heading) => {
      heading.addEventListener('click', () => {
        const targetTag = heading.textContent.trim();
        console.log('Safari heading clicked:', targetTag);
        console.log(
          'Safari current videos:',
          videos.map((v) => v.dataset.tag)
        );

        const targetIndex = videos.findIndex(
          (video) => video.dataset.tag === targetTag
        );

        console.log('Safari target video index found:', targetIndex);
        console.log('Safari current index:', currentIndex);

        if (targetIndex !== -1) {
          const direction = targetIndex > currentIndex ? 'down' : 'up';
          console.log('Safari moving:', direction);
          showVideo(targetIndex, direction);
        } else {
          console.log('Safari no video found for tag:', targetTag);
        }
      });
    });

    // Initial build for Safari
    rebuildSafariVideoDisplay();

    // Function to toggle play/pause for the current video
    function togglePlayPause() {
      if (videos.length === 0) return;

      const currentVideo = videos[currentIndex];
      const iframe = currentVideo.querySelector('iframe');

      if (iframe && iframe.contentWindow) {
        try {
          if (isVideoPlaying) {
            // Pause the video
            iframe.contentWindow.postMessage(
              '{"event":"command","func":"pauseVideo","args":""}',
              '*'
            );
            isVideoPlaying = false;
            showPlayIndicator(currentVideo);
            console.log('Paused video');
          } else {
            // Play the video
            iframe.contentWindow.postMessage(
              '{"event":"command","func":"playVideo","args":""}',
              '*'
            );
            isVideoPlaying = true;
            hidePlayIndicator(currentVideo);
            console.log('Played video');
          }
        } catch (e) {
          console.error('Error toggling video:', e);

          // On iOS, we might need to reload the iframe
          if (isIOS) {
            try {
              // For iOS, sometimes we need to set the src directly
              const currentSrc = iframe.src;

              // Toggle autoplay parameter in the URL
              let newSrc = currentSrc;
              if (newSrc.includes('autoplay=0')) {
                newSrc = newSrc.replace('autoplay=0', 'autoplay=1');
                isVideoPlaying = true;
                hidePlayIndicator(currentVideo);
              } else if (newSrc.includes('autoplay=1')) {
                newSrc = newSrc.replace('autoplay=1', 'autoplay=0');
                isVideoPlaying = false;
                showPlayIndicator(currentVideo);
              } else {
                // If no autoplay parameter, add it
                const separator = newSrc.includes('?') ? '&' : '?';
                newSrc = `${newSrc}${separator}autoplay=1`;
                isVideoPlaying = true;
                hidePlayIndicator(currentVideo);
              }

              iframe.src = newSrc;
              console.log('iOS fallback - set src directly:', newSrc);
            } catch (iosError) {
              console.error('iOS fallback error:', iosError);
            }
          }
        }
      }
    }

    // Function to show play indicator
    function showPlayIndicator(videoElement) {
      let playIndicator = videoElement.querySelector('.play-indicator');

      if (!playIndicator) {
        playIndicator = document.createElement('div');
        playIndicator.className = 'play-indicator';
        playIndicator.innerHTML = `
                <svg width="80" height="80" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.6)"/>
                    <path d="M8 6v12l10-6z" fill="white"/>
                </svg>
            `;
        playIndicator.style.position = 'absolute';
        playIndicator.style.top = '50%';
        playIndicator.style.left = '50%';
        playIndicator.style.transform = 'translate(-50%, -50%)';
        playIndicator.style.zIndex = '3';
        playIndicator.style.opacity = '0';
        playIndicator.style.transition = 'opacity 0.3s ease';

        videoElement.appendChild(playIndicator);
      }

      // Show with slight delay for better visual effect
      setTimeout(() => {
        playIndicator.style.opacity = '1';
      }, 50);
    }

    // Function to hide play indicator
    function hidePlayIndicator(videoElement) {
      const playIndicator = videoElement.querySelector('.play-indicator');
      if (playIndicator) {
        playIndicator.style.opacity = '0';
      }
    }

    // Function to pause all videos
    function pauseAllVideos() {
      videos.forEach((video) => {
        const iframe = video.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage(
              '{"event":"command","func":"pauseVideo","args":""}',
              '*'
            );
          } catch (e) {
            console.error('Error pausing video:', e);
          }
        }
      });
      isVideoPlaying = false;
    }

    // Show a specific video with animation
    function showVideo(index, direction) {
      if (isScrolling || index === currentIndex || videos.length === 0) return;

      console.log(`Navigating from ${currentIndex} to ${index} (${direction})`);

      isScrolling = true;
      scrollDirection = direction;

      // Update headings based on the target video's tag
      const targetTag = videos[index].dataset.tag;
      const currentHeadings = document.querySelectorAll('.youtube-heading');
      currentHeadings.forEach((heading) => {
        if (heading.textContent.trim() === targetTag) {
          heading.classList.add('active');
        } else {
          heading.classList.remove('active');
        }
      });

      // Update sticky elements with current information
      updateStickyInfo(index);

      const currentVideo = videos[currentIndex];
      const targetVideo = videos[index];

      // Pause current video before transition
      const currentIframe = currentVideo.querySelector('iframe');
      if (currentIframe) {
        try {
          currentIframe.contentWindow.postMessage(
            '{"event":"command","func":"pauseVideo","args":""}',
            '*'
          );
        } catch (e) {
          console.error('Error pausing current video:', e);
        }
      }

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

      // Update current index
      currentIndex = index;

      // Handle target video autoplay - IMPROVED LOGIC
      const targetIframe = targetVideo.querySelector('iframe');
      if (targetIframe) {
        // Instead of always replacing iframe, try URL modification first
        const currentSrc = targetIframe.getAttribute('src');

        if (!iframeReplacementTracker.has(targetIframe)) {
          // First time accessing this video - replace iframe
          const parent = targetIframe.parentNode;
          const newIframe = document.createElement('iframe');

          // Copy all attributes except src
          for (let i = 0; i < targetIframe.attributes.length; i++) {
            const attr = targetIframe.attributes[i];
            if (attr.name !== 'src') {
              newIframe.setAttribute(attr.name, attr.value);
            }
          }

          const modifiedSrc = getModifiedSrc(currentSrc, true);
          newIframe.src = modifiedSrc;

          // Track replacement
          iframeReplacementTracker.add(newIframe);

          parent.replaceChild(newIframe, targetIframe);
          isVideoPlaying = true;

          setTimeout(() => {
            try {
              newIframe.contentWindow.postMessage(
                '{"event":"command","func":"playVideo","args":""}',
                '*'
              );
            } catch (e) {
              console.error('Error playing new iframe:', e);
            }
          }, 600);
        } else {
          // iframe already replaced before - just modify URL if needed
          if (!currentSrc.includes('autoplay=1')) {
            const newSrc = getModifiedSrc(currentSrc, true);
            targetIframe.src = newSrc;
          }

          // Try to play
          setTimeout(() => {
            try {
              targetIframe.contentWindow.postMessage(
                '{"event":"command","func":"playVideo","args":""}',
                '*'
              );
              isVideoPlaying = true;
            } catch (e) {
              console.error('Error playing existing iframe:', e);
            }
          }, 600);
        }
      }

      // Reset after animation
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
      }, 550);
    }

    // Update sticky information displays
    function updateStickyInfo(index) {
      if (videos.length === 0 || index >= videos.length) return;

      const video = videos[index];
      const tag = video.dataset.tag;

      // Update style name
      const styleNameElement = document.querySelector('.style-name');
      if (styleNameElement) {
        styleNameElement.textContent = tag;
      }

      // Update current video number (show actual video index)
      const currentVideoElement = document.querySelector('.current-video');
      if (currentVideoElement) {
        currentVideoElement.textContent = index + 1; // Direct index + 1
      }

      // Update total videos
      const totalVideosElement = document.querySelector('.total-videos');
      if (totalVideosElement) {
        totalVideosElement.textContent = videos.length;
      }
    }

    // Function to setup Safari video elements
    function setupSafariVideoElements() {
      videos.forEach((video) => {
        // Set position
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.zIndex = '0';

        // Ensure iframes have enablejsapi parameter
        const iframe = video.querySelector('iframe');
        if (iframe && iframe.src && !iframe.src.includes('enablejsapi=1')) {
          const url = new URL(iframe.src);
          url.searchParams.set('enablejsapi', '1');
          iframe.src = url.toString();
        }

        // Different approach for iOS vs other platforms
        if (isIOS) {
          // Create a separate overlay for scrolling
          const scrollOverlay = document.createElement('div');
          scrollOverlay.className = 'youtube-short-scroll-overlay';
          scrollOverlay.style.position = 'absolute';
          scrollOverlay.style.top = '0';
          scrollOverlay.style.left = '0';
          scrollOverlay.style.width = '100%';
          scrollOverlay.style.height = '100%';
          scrollOverlay.style.zIndex = '2';
          scrollOverlay.style.pointerEvents = 'auto';

          // Add wheel event handler to the scroll overlay
          scrollOverlay.addEventListener('wheel', handleWheel, {
            passive: false,
          });

          // Add touch handlers to the scroll overlay
          scrollOverlay.addEventListener('touchstart', handleTouchStart, {
            passive: true,
          });
          scrollOverlay.addEventListener('touchend', handleTouchEnd, {
            passive: true,
          });

          // Create an actual button for play/pause that sits in the middle
          const playButton = document.createElement('button');
          playButton.className = 'youtube-short-play-button';
          playButton.setAttribute('type', 'button');
          playButton.style.position = 'absolute';
          playButton.style.top = '50%';
          playButton.style.left = '50%';
          playButton.style.transform = 'translate(-50%, -50%)';
          playButton.style.width = '80px';
          playButton.style.height = '80px';
          playButton.style.borderRadius = '50%';
          playButton.style.background = 'rgba(0, 0, 0, 0.3)';
          playButton.style.border = 'none';
          playButton.style.outline = 'none';
          playButton.style.zIndex = '3';
          playButton.style.display = 'flex';
          playButton.style.alignItems = 'center';
          playButton.style.justifyContent = 'center';
          playButton.style.cursor = 'pointer';
          playButton.style.opacity = '0'; // Start hidden
          playButton.style.transition = 'opacity 0.3s ease';
          playButton.style.pointerEvents = 'auto';
          playButton.style.webkitTapHighlightColor = 'transparent';

          // Add play icon to the button
          playButton.innerHTML = `
          <svg width="40" height="40" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" fill="white"/>
          </svg>
        `;

          // Add click handler to the play button
          playButton.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            // Only respond if this is the current video
            if (videos.indexOf(video) === currentIndex) {
              togglePlayPause();
            }
          });

          // Show play button when user taps the scroll overlay
          scrollOverlay.addEventListener('click', function (e) {
            // Only respond if this is the current video
            if (videos.indexOf(video) === currentIndex) {
              // Show the play button
              playButton.style.opacity = '1';

              // Hide it after 3 seconds
              setTimeout(() => {
                playButton.style.opacity = '0';
              }, 3000);
            }
          });

          // Add the play button to the video
          video.appendChild(playButton);

          // Add the scroll overlay to all videos
          video.appendChild(scrollOverlay);
        } else {
          // For non-iOS, we can use a simpler approach
          const overlay = document.createElement('div');
          overlay.className = 'youtube-short-overlay';
          overlay.style.position = 'absolute';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100%';
          overlay.style.height = '100%';
          overlay.style.zIndex = '2';
          overlay.style.cursor = 'pointer';

          overlay.addEventListener('click', (e) => {
            if (!isScrolling) {
              // Find out which video was clicked
              const clickedVideoIndex = videos.indexOf(video);

              // Only toggle play/pause if it's the current video
              if (clickedVideoIndex === currentIndex) {
                togglePlayPause();
              }
            }
          });

          // Add wheel event handler to all videos
          overlay.addEventListener('wheel', handleWheel, { passive: false });

          // Add to video
          video.appendChild(overlay);
        }

        // Add initial play indicator
        showPlayIndicator(video);
      });
    }

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .youtube-short-overlay, .youtube-short-scroll-overlay {
            pointer-events: auto;
            background: transparent;
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            user-select: none;
        }
        
        .youtube-short-play-button {
            -webkit-appearance: none;
            appearance: none;
            -webkit-tap-highlight-color: transparent !important;
        }
        
        .youtube-short-play-button:active {
            background: rgba(0, 0, 0, 0.5);
        }
        
        .play-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            -webkit-tap-highlight-color: transparent;
            pointer-events: none;
        }
        
        .play-indicator svg {
            filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.3));
        }
        
        iframe {
            border: none;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }
        
        .youtube-shorts-wrapper {
            position: relative;
        }
        
        @supports (-webkit-touch-callout: none) {
            .youtube-short-play-button {
                -webkit-transform: translateZ(0);
                -webkit-backface-visibility: hidden;
            }
        }
    `;
    document.head.appendChild(style);

    // Add click events to navigation buttons
    const prevButton = document.querySelector('.prev-button');
    if (prevButton) {
      prevButton.addEventListener('click', () => {
        if (videos.length > 0) {
          const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
          showVideo(prevIndex, 'up');
        }
      });
    }

    const nextButton = document.querySelector('.next-button');
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        if (videos.length > 0) {
          const nextIndex = (currentIndex + 1) % videos.length;
          showVideo(nextIndex, 'down');
        }
      });
    }

    const playPauseButton = document.querySelector('.play-pause-button');
    if (playPauseButton) {
      playPauseButton.addEventListener('click', () => {
        togglePlayPause();
      });
    }

    // Add event listener for back button to pause videos
    const backButton = document.querySelector('.back-btn');
    if (backButton) {
      backButton.addEventListener('click', () => {
        pauseAllVideos();
        console.log('Back button clicked, all videos paused');
      });
    }

    // Add keyboard controls
    document.addEventListener('keydown', function (event) {
      if (videos.length === 0) return;

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

    // Touch and wheel handling
    let touchStartY = 0;
    let touchStartTime = 0;
    let lastTouchTime = 0;

    function handleTouchStart(e) {
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }

    function handleTouchEnd(e) {
      if (isScrolling || videos.length === 0) return;

      const now = Date.now();
      if (now - lastTouchTime < 500) {
        return;
      }

      const touchEndY = e.changedTouches[0].clientY;
      const touchDuration = now - touchStartTime;
      const diffY = touchStartY - touchEndY;

      // Only handle swipes, not taps
      if (Math.abs(diffY) > 50 && touchDuration < 500) {
        if (diffY > 0) {
          // Swipe up - next video
          const nextIndex = (currentIndex + 1) % videos.length;
          showVideo(nextIndex, 'down');
        } else {
          // Swipe down - previous video
          const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
          showVideo(prevIndex, 'up');
        }
        lastTouchTime = now;
      }
    }

    // Handle trackpad/mouse wheel scrolling
    let wheelTimeout = null;
    let lastWheelTime = 0;

    function handleWheel(e) {
      if (isScrolling || videos.length === 0) return;

      e.preventDefault();

      const now = Date.now();
      if (now - lastWheelTime < 500) {
        return;
      }

      if (wheelTimeout) {
        clearTimeout(wheelTimeout);
      }

      wheelTimeout = setTimeout(() => {
        if (e.deltaY > 0) {
          const nextIndex = (currentIndex + 1) % videos.length;
          showVideo(nextIndex, 'down');
        } else {
          const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
          showVideo(prevIndex, 'up');
        }

        lastWheelTime = now;
        wheelTimeout = null;
      }, 50);
    }

    // Add touch and wheel handlers to the shorts wrapper
    if (shortsWrapper) {
      shortsWrapper.addEventListener('touchstart', handleTouchStart, {
        passive: true,
      });
      shortsWrapper.addEventListener('touchend', handleTouchEnd, {
        passive: true,
      });
      shortsWrapper.addEventListener('wheel', handleWheel, { passive: false });
    }

    // Function to initialize Safari first video
    function initializeSafariFirstVideo() {
      if (videos.length > 0) {
        videos[0].classList.add('active');
        videos[0].style.zIndex = '1';

        const initialTag = videos[0].dataset.tag;
        const currentHeadings = document.querySelectorAll('.youtube-heading');
        currentHeadings.forEach((heading) => {
          if (heading.textContent.trim() === initialTag) {
            heading.classList.add('active');
          }
        });

        updateStickyInfo(0);

        // Show welcome message
        const startupMessage = document.createElement('div');
        startupMessage.style.position = 'fixed';
        startupMessage.style.top = '20px';
        startupMessage.style.left = '50%';
        startupMessage.style.transform = 'translateX(-50%)';
        startupMessage.style.background = 'rgba(0, 0, 0, 0.8)';
        startupMessage.style.color = 'white';
        startupMessage.style.padding = '10px 20px';
        startupMessage.style.borderRadius = '20px';
        startupMessage.style.zIndex = '1000';
        startupMessage.style.fontSize = '16px';
        startupMessage.style.textAlign = 'center';
        startupMessage.style.maxWidth = '80%';

        if (isIOS) {
          startupMessage.innerHTML =
            'Swipe to navigate. Tap video then use play button.';
        } else {
          startupMessage.innerHTML =
            'Swipe or scroll to navigate. Tap video to play/pause.';
        }

        document.body.appendChild(startupMessage);
        setTimeout(() => {
          startupMessage.style.transition = 'opacity 0.5s ease';
          startupMessage.style.opacity = '0';
          setTimeout(() => {
            startupMessage.remove();
          }, 500);
        }, 3000);
      }
    }
  });
} else {
  // Fallback for other browsers/devices
  console.log('Unknown browser or device');
  document.body.style.backgroundColor = 'gray';
}
