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

function setupHeadingVisibilityWatcher() {
  console.log('Setting up heading visibility watcher');

  // Get all headings
  const headings = document.querySelectorAll('.youtube-heading');

  // Create a function to rebuild the video list based on visible headings
  function rebuildVideoList() {
    console.log('Rebuilding video list based on visible headings');

    // Save current playing state and current tag before rebuilding
    const currentlyPlaying = isVideoPlaying;
    const currentTag =
      videos && videos.length > 0 && currentIndex < videos.length
        ? videos[currentIndex].dataset.tag
        : null;

    // Get original videos - these are the actual source videos, not the clones
    const originalVideos = Array.from(
      document.querySelectorAll('.youtube-short')
    );
    const shortsWrapper = document.querySelector('.youtube-shorts-wrapper');

    // Get only visible headings
    const visibleHeadings = Array.from(headings).filter(
      (heading) => window.getComputedStyle(heading).display !== 'none'
    );

    console.log('Visible headings found:', visibleHeadings.length);

    // If no visible headings, don't proceed
    if (visibleHeadings.length === 0) {
      console.warn('No visible headings found, keeping current videos');
      return videos || [];
    }

    // Create a mapping of videos for each visible tag
    let newVideos = [];
    const headingTags = visibleHeadings.map((heading) =>
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

          newVideos.push(clonedVideo);
        }
      });
    });

    // Sort videos based on tag order
    newVideos.sort((a, b) => {
      const tagA = a.dataset.tag;
      const tagB = b.dataset.tag;
      const indexA = headingTags.indexOf(tagA);
      const indexB = headingTags.indexOf(tagB);
      return indexA - indexB;
    });

    // If no videos were found for visible tags, log and return early
    if (newVideos.length === 0) {
      console.warn('No videos found for visible tags');
      return videos || [];
    }

    // Replace original videos with our new organized list
    // First, clear the shorts wrapper
    while (shortsWrapper.firstChild) {
      shortsWrapper.removeChild(shortsWrapper.firstChild);
    }

    // Then add our new organized videos
    newVideos.forEach((video) => {
      shortsWrapper.appendChild(video);
    });

    // Try to find the previously active tag in the new list
    let startIndex = 0;
    if (currentTag) {
      const sameTagIndex = newVideos.findIndex(
        (v) => v.dataset.tag === currentTag
      );
      if (sameTagIndex !== -1) {
        startIndex = sameTagIndex;
        console.log(
          `Found previous tag "${currentTag}" at index ${startIndex}`
        );
      }
    }

    // Reset current index and setup video
    currentIndex = startIndex;

    if (newVideos.length > 0) {
      // Reset all videos first
      newVideos.forEach((video) => {
        video.classList.remove('active');
        video.style.zIndex = '0';
        video.style.transform = '';
      });

      // Set active video
      newVideos[startIndex].classList.add('active');
      newVideos[startIndex].style.zIndex = '1';

      const initialTag = newVideos[startIndex].dataset.tag;
      headings.forEach((heading) => {
        if (heading.textContent.trim() === initialTag) {
          heading.classList.add('active');
        } else {
          heading.classList.remove('active');
        }
      });

      // Setup the video's iframe if needed
      const videoIframe = newVideos[startIndex].querySelector('iframe');
      if (videoIframe) {
        try {
          // Set up iframe
          const parent = videoIframe.parentNode;
          const originalSrc = videoIframe.getAttribute('src');

          if (originalSrc) {
            // Create a new iframe element
            const newIframe = document.createElement('iframe');

            // Copy all attributes except src
            for (let i = 0; i < videoIframe.attributes.length; i++) {
              const attr = videoIframe.attributes[i];
              if (attr.name !== 'src') {
                newIframe.setAttribute(attr.name, attr.value);
              }
            }

            // Set src based on whether it should autoplay
            const modifiedSrc = getModifiedSrc(originalSrc, currentlyPlaying);
            newIframe.src = modifiedSrc;

            // Replace the old iframe
            parent.replaceChild(newIframe, videoIframe);
            isVideoPlaying = currentlyPlaying;

            // For YouTube to register the command, add a play message after load
            if (currentlyPlaying) {
              setTimeout(() => {
                try {
                  if (newIframe.contentWindow) {
                    newIframe.contentWindow.postMessage(
                      '{"event":"command","func":"playVideo","args":""}',
                      '*'
                    );
                  }
                } catch (e) {
                  console.error('Error sending play command to video:', e);
                }
              }, 500);
            }
          }
        } catch (e) {
          console.error('Error setting up iframe:', e);
        }
      }

      // Update sticky info if available
      if (typeof updateStickyInfo === 'function') {
        updateStickyInfo(startIndex);
      }

      // Prepare adjacent videos if available
      if (typeof prepareAdjacentVideos === 'function') {
        prepareAdjacentVideos(startIndex);
      }

      console.log(
        `Video display initialized at index ${startIndex} with tag "${initialTag}"`
      );
    }

    return newVideos;
  }

  // Set up mutation observer to watch for style changes in headings
  const headingObserver = new MutationObserver((mutations) => {
    let shouldRebuild = false;

    mutations.forEach((mutation) => {
      if (
        mutation.type === 'attributes' &&
        mutation.attributeName === 'style'
      ) {
        // Check if display actually changed to/from 'none'
        const target = mutation.target;
        const isVisible = window.getComputedStyle(target).display !== 'none';

        // Get previous visibility state from dataset
        const wasVisible = target.dataset.wasVisible !== 'false';

        // If visibility changed, mark for rebuild
        if (isVisible !== wasVisible) {
          shouldRebuild = true;
          // Store current state for next comparison
          target.dataset.wasVisible = isVisible;
          console.log(
            `Heading "${target.textContent.trim()}" visibility changed to: ${
              isVisible ? 'visible' : 'hidden'
            }`
          );
        }
      }
    });

    if (shouldRebuild) {
      // Small delay to let all style changes apply
      setTimeout(() => {
        // Rebuild videos and update the global videos array
        videos = rebuildVideoList();
        console.log('Videos rebuilt. New count:', videos.length);
      }, 50);
    }
  });

  // Initialize visibility state and observe each heading
  headings.forEach((heading) => {
    // Store initial visibility state
    const isVisible = window.getComputedStyle(heading).display !== 'none';
    heading.dataset.wasVisible = isVisible;

    // Observe for style changes
    headingObserver.observe(heading, {
      attributes: true,
      attributeFilter: ['style', 'class'], // Watch both style and class changes
    });
  });

  // Do an initial build of the videos list
  return rebuildVideoList();
}

// Main conditional logic
if (isChrome() || isWindows() || isAndroid()) {
  document.addEventListener('DOMContentLoaded', function () {
    // Get all original videos and headings
    const originalVideos = Array.from(
      document.querySelectorAll('.youtube-short')
    );
    const headings = document.querySelectorAll('.youtube-heading');
    const shortsWrapper = document.querySelector('.youtube-shorts-wrapper');
    let currentIndex = 0;
    let isScrolling = false;
    let scrollDirection = null;
    let isVideoPlaying = true;

    console.log('Videos found:', originalVideos.length);

    // Create a mapping of videos for each tag
    let videos = setupHeadingVisibilityWatcher();
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

    // Add click event to headings
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

    // Add keyboard controls
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

    // Function to update sticky information elements
    function updateStickyInfo(index) {
      const currentVideo = videos[index];
      const currentTag = currentVideo.dataset.tag;
      const currentPosition = currentVideo.dataset.tagPosition;
      const totalVideosInTag = videosPerTag[currentTag];

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
        const totalVideoNumber = parseInt(totalVideosInTag) - 1;
        totalVideosElement.textContent = totalVideoNumber;
      }
    }

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
  });
} else if (isSafari() || isIPhone()) {
  // Wait for the DOM to be fully loaded
  document.addEventListener('DOMContentLoaded', function () {
    // Core variables
    const originalVideos = Array.from(
      document.querySelectorAll('.youtube-short')
    );
    const headings = document.querySelectorAll('.youtube-heading');
    const shortsWrapper = document.querySelector('.youtube-shorts-wrapper');
    let videos = setupHeadingVisibilityWatcher();
    let currentIndex = 0;
    let isScrolling = false;
    let isVideoPlaying = false;

    // Detect iOS devices
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    console.log('iOS device detected:', isIOS);

    console.log('Videos found:', originalVideos.length);

    // Create video mapping based on tags
    const headingTags = Array.from(headings).map((heading) =>
      heading.textContent.trim()
    );
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

          videos.push(clonedVideo);
        }
      });
    });

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

    // Function to toggle play/pause for the current video
    function togglePlayPause() {
      const currentVideo = videos[currentIndex];

      // Check if this is the first video of its tag
      const isFirstOfTag = currentVideo.dataset.tagPosition === '1';

      // If it's the first video of its tag, don't toggle play/pause
      if (isFirstOfTag) {
        console.log('First video of tag - play/pause not available');
        return;
      }

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
      // Check if this is the first video of its tag - don't show indicator if it is
      if (videoElement.dataset.tagPosition === '1') {
        return;
      }

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

    // Function to prepare YouTube iframe URL
    function prepareYouTubeUrl(src) {
      // If no source or about:blank, return empty
      if (!src || src === 'about:blank') {
        return '';
      }

      // Add protocol if missing
      let newSrc = src;
      if (newSrc.startsWith('//')) {
        newSrc = 'https:' + newSrc;
      }

      // Clean up existing parameters
      const urlParts = newSrc.split('?');
      const baseUrl = urlParts[0];
      const params = new URLSearchParams(urlParts[1] || '');

      // Set required parameters
      params.set('enablejsapi', '1');
      params.set('controls', '1');
      params.set('playsinline', '1');
      params.set('rel', '0');

      return `${baseUrl}?${params.toString()}`;
    }

    // Show a specific video with animation
    function showVideo(index, direction) {
      if (isScrolling || index === currentIndex) return;
      isScrolling = true;

      // Pause all currently playing videos
      pauseAllVideos();

      // Update headings
      const targetTag = videos[index].dataset.tag;
      headings.forEach((heading) => {
        if (heading.textContent.trim() === targetTag) {
          heading.classList.add('active');
        } else {
          heading.classList.remove('active');
        }
      });

      // Scroll active heading into view
      headings.forEach((heading) => {
        if (heading.textContent.trim() === targetTag) {
          heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      // Update information display
      updateStickyInfo(index);

      // Prepare animation
      const currentVideo = videos[currentIndex];
      const targetVideo = videos[index];

      // Show play indicator on the new video
      showPlayIndicator(targetVideo);

      currentVideo.style.transition = 'transform 0.4s ease-out';
      targetVideo.style.transition = 'transform 0.4s ease-out';

      // Set initial positions
      if (direction === 'up') {
        targetVideo.style.transform = 'translateY(-100%)';
        setTimeout(() => {
          currentVideo.style.transform = 'translateY(100%)';
          targetVideo.style.transform = 'translateY(0)';
        }, 20);
      } else {
        targetVideo.style.transform = 'translateY(100%)';
        setTimeout(() => {
          currentVideo.style.transform = 'translateY(-100%)';
          targetVideo.style.transform = 'translateY(0)';
        }, 20);
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
      }, 450);
    }

    // Update sticky information displays
    function updateStickyInfo(index) {
      const video = videos[index];
      const tag = video.dataset.tag;
      const position = video.dataset.tagPosition;
      const total = videosPerTag[tag];

      // Update style name
      const styleNameElement = document.querySelector('.style-name');
      if (styleNameElement) {
        styleNameElement.textContent = tag;
      }

      // Update video counter
      const currentVideoElement = document.querySelector('.current-video');
      if (currentVideoElement) {
        currentVideoElement.textContent = parseInt(position) - 1;
      }

      // Update total videos
      const totalVideosElement = document.querySelector('.total-videos');
      if (totalVideosElement) {
        totalVideosElement.textContent = parseInt(total) - 1;
      }
    }

    // Function to restart current category
    function restartCurrentCategory() {
      const currentTag = videos[currentIndex].dataset.tag;
      const firstIndex = videos.findIndex(
        (video) =>
          video.dataset.tag === currentTag && video.dataset.tagPosition === '1'
      );

      if (firstIndex !== -1 && firstIndex !== currentIndex) {
        const direction = firstIndex > currentIndex ? 'down' : 'up';
        showVideo(firstIndex, direction);
      }
    }

    // Set up videos
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

      // Check if this is the first video of its tag
      const isFirstOfTag = video.dataset.tagPosition === '1';

      // Different approach for iOS vs other platforms
      if (isIOS) {
        // For iOS, we need a button for better interaction
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

        // Only add play button if this is NOT the first video of its tag
        if (!isFirstOfTag) {
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
        }

        // Add the scroll overlay to all videos
        video.appendChild(scrollOverlay);
      } else {
        // For non-iOS, we can use a simpler approach
        // Create a transparent overlay for scrolling AND play control
        const overlay = document.createElement('div');
        overlay.className = 'youtube-short-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.zIndex = '2';
        overlay.style.cursor = 'pointer';

        // Only add click handler for play/pause if not the first video of its tag
        if (!isFirstOfTag) {
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
        }

        // Add wheel event handler to all videos
        overlay.addEventListener('wheel', handleWheel, { passive: false });

        // Add to video
        video.appendChild(overlay);
      }

      // Add initial play indicator if not the first video of its tag
      if (!isFirstOfTag) {
        showPlayIndicator(video);
      }
    });

    // REMOVED: Navigation buttons creation
    // Instead, we'll just add the styles for the nav buttons
    // which you've already created in your HTML

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .nav-buttons {
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            flex-direction: column;
            gap: 15px;
            z-index: 100;
        }
        
       
        
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
            pointer-events: none; /* Important: Make iframes NOT capture events */
        }
        
        .youtube-shorts-wrapper {
            position: relative;
        }
        
        /* iOS specific fixes */
        @supports (-webkit-touch-callout: none) {
            .youtube-short-play-button {
                -webkit-transform: translateZ(0);
                -webkit-backface-visibility: hidden;
            }
        }
    `;
    document.head.appendChild(style);

    // Add click events to navigation buttons that you've already created in HTML
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

    // Add click event for restart button
    const shutDownElement = document.querySelector('.shut-down');
    if (shutDownElement) {
      shutDownElement.addEventListener('click', restartCurrentCategory);
    }

    // Add click events to headings
    headings.forEach((heading) => {
      heading.addEventListener('click', () => {
        const targetTag = heading.textContent.trim();
        const targetIndex = videos.findIndex(
          (video) => video.dataset.tag === targetTag
        );
        if (targetIndex !== -1) {
          const direction = targetIndex > currentIndex ? 'down' : 'up';
          showVideo(targetIndex, direction);
        }
      });
    });

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
      // Store touch coordinates and time
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }

    function handleTouchEnd(e) {
      if (isScrolling) return;

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
      if (isScrolling) return;

      // Prevent default scrolling behavior
      e.preventDefault();

      // Debounce wheel events to prevent multiple videos being scrolled at once
      const now = Date.now();
      if (now - lastWheelTime < 500) {
        // Ignore wheel events that come too quickly after the previous one
        return;
      }

      // Clear any existing timeout
      if (wheelTimeout) {
        clearTimeout(wheelTimeout);
      }

      // Set a new timeout to handle the wheel event
      wheelTimeout = setTimeout(() => {
        if (e.deltaY > 0) {
          // Scroll down - next video
          const nextIndex = (currentIndex + 1) % videos.length;
          showVideo(nextIndex, 'down');
        } else {
          // Scroll up - previous video
          const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
          showVideo(prevIndex, 'up');
        }

        // Update the last wheel time
        lastWheelTime = now;
        wheelTimeout = null;
      }, 50);
    }

    // Add touch and wheel handlers to the shorts wrapper
    shortsWrapper.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    shortsWrapper.addEventListener('touchend', handleTouchEnd, {
      passive: true,
    });
    shortsWrapper.addEventListener('wheel', handleWheel, { passive: false });

    // Document-level wheel event handler as a failsafe
    document.addEventListener(
      'wheel',
      function (e) {
        // Check if the wheel event is within the shortsWrapper area
        const rect = shortsWrapper.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          handleWheel(e);
        }
      },
      { passive: false }
    );

    // Initialize first video
    if (videos.length > 0) {
      videos[0].classList.add('active');
      videos[0].style.zIndex = '1';

      const initialTag = videos[0].dataset.tag;
      headings.forEach((heading) => {
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
  });
} else {
  // Fallback for other browsers/devices
  console.log('Unknown browser or device');
  document.body.style.backgroundColor = 'gray'; // Default fallback color
}
