document.addEventListener('DOMContentLoaded', function() {
    const carouselItems = document.querySelectorAll('.carousel-3d-item');
    const prevBtn = document.getElementById('carousel-prev-3d');
    const nextBtn = document.getElementById('carousel-next-3d');
    const indicators = document.querySelectorAll('.indicator');
    const loansData = document.getElementById('loans-data');
    let currentIndex = 0;
    let loans = [];
  
    // Parse loans data
    if (loansData) {
      try {
        loans = JSON.parse(loansData.textContent);
      } catch (err) {
        console.error('Error parsing loans data:', err);
      }
    }
  
    function updateCarousel(newIndex) {
      if (newIndex < 0 || newIndex >= carouselItems.length) return;
      
      // Remove active class
      carouselItems.forEach(item => item.classList.remove('active'));
      indicators.forEach(ind => ind.classList.remove('active'));
      
      // Update positions with 3D transforms
      carouselItems.forEach((item, index) => {
        const diff = index - newIndex;
        let transform = '';
        let opacity = 1;
        let zIndex = 1;
        let scale = 1;
        let rotateY = 0;
        let translateX = 0;
        
        if (diff === 0) {
          // Active item (center)
          transform = 'translate(-50%, -50%) translateX(0) rotateY(0deg) scale(1)';
          opacity = 1;
          zIndex = 10;
          item.classList.add('active');
        } else if (diff === -1) {
          // One item to the left
          transform = 'translate(-50%, -50%) translateX(-200px) rotateY(15deg) scale(0.92)';
          opacity = 0.8;
          zIndex = 2;
        } else if (diff === -2) {
          // Two items to the left
          transform = 'translate(-50%, -50%) translateX(-400px) rotateY(25deg) scale(0.85)';
          opacity = 0.6;
          zIndex = 1;
        } else if (diff === 1) {
          // One item to the right
          transform = 'translate(-50%, -50%) translateX(200px) rotateY(-15deg) scale(0.92)';
          opacity = 0.8;
          zIndex = 2;
        } else if (diff === 2) {
          // Two items to the right
          transform = 'translate(-50%, -50%) translateX(400px) rotateY(-25deg) scale(0.85)';
          opacity = 0.6;
          zIndex = 1;
        } else if (diff < -2) {
          // Hidden items on the left
          transform = 'translate(-50%, -50%) translateX(-600px) rotateY(35deg) scale(0.7)';
          opacity = 0;
          zIndex = 0;
        } else {
          // Hidden items on the right
          transform = 'translate(-50%, -50%) translateX(600px) rotateY(-35deg) scale(0.7)';
          opacity = 0;
          zIndex = 0;
        }
        
        item.style.transform = transform;
        item.style.opacity = opacity;
        item.style.zIndex = zIndex;
        item.style.pointerEvents = (diff === 0) ? 'auto' : 'none';
      });
      
      // Update active indicator
      if (indicators[newIndex]) {
        indicators[newIndex].classList.add('active');
      }
      
      currentIndex = newIndex;
      
      // Update detail section (sync with main.js)
      if (loans[newIndex] && typeof window.showDetail === 'function') {
        window.showDetail(newIndex);
      } else {
        updateDetailSection(newIndex);
      }
    }
  
    // Update detail section manually if showDetail not available
    function updateDetailSection(index) {
      const loan = loans[index];
      if (!loan) return;
  
      // Update hero image
      const heroImage = document.getElementById('hero-image');
      if (heroImage) {
        heroImage.style.opacity = '0';
        setTimeout(() => {
          heroImage.src = loan.image || '/images/buku.png';
          heroImage.style.opacity = '1';
        }, 200);
      }
  
      // Update book info
      const titleEl = document.getElementById('detail-title');
      const authorEl = document.getElementById('detail-author');
      const yearEl = document.getElementById('detail-year');
      const editionEl = document.getElementById('detail-edition');
      const pagesEl = document.getElementById('detail-pages');
      const sizeEl = document.getElementById('detail-size');
      const languageEl = document.getElementById('detail-language');
  
      if (titleEl) titleEl.textContent = loan.title || 'Tanpa Judul';
      if (authorEl) authorEl.innerHTML = `<i class="fa-solid fa-user mr-2"></i>${loan.author || '-'}`;
      if (yearEl) yearEl.textContent = loan.publish_year || '-';
      if (editionEl) editionEl.textContent = loan.edition || '-';
      if (pagesEl) pagesEl.textContent = loan.pages || '-';
      if (sizeEl) sizeEl.textContent = loan.size || '-';
      if (languageEl) languageEl.textContent = loan.language_id || 'Indonesia';
    }
  
    // Previous button
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : carouselItems.length - 1;
        updateCarousel(newIndex);
      });
    }
  
    // Next button
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        const newIndex = currentIndex < carouselItems.length - 1 ? currentIndex + 1 : 0;
        updateCarousel(newIndex);
      });
    }
  
    // Indicator click
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', function() {
        updateCarousel(index);
      });
    });
  
    // Carousel item click (untuk non-active items)
    carouselItems.forEach((item, index) => {
      item.addEventListener('click', function() {
        if (!item.classList.contains('active')) {
          updateCarousel(index);
        }
      });
    });
  
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowLeft') {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : carouselItems.length - 1;
        updateCarousel(newIndex);
      } else if (e.key === 'ArrowRight') {
        const newIndex = currentIndex < carouselItems.length - 1 ? currentIndex + 1 : 0;
        updateCarousel(newIndex);
      }
    });
  
    // Touch/swipe support for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    const carouselWrapper = document.querySelector('.carousel-3d-wrapper');
  
    if (carouselWrapper) {
      carouselWrapper.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
      });
  
      carouselWrapper.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
      });
  
      function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
  
        if (Math.abs(diff) > swipeThreshold) {
          if (diff > 0) {
            // Swipe left - go to next
            const newIndex = currentIndex < carouselItems.length - 1 ? currentIndex + 1 : 0;
            updateCarousel(newIndex);
          } else {
            // Swipe right - go to previous
            const newIndex = currentIndex > 0 ? currentIndex - 1 : carouselItems.length - 1;
            updateCarousel(newIndex);
          }
        }
      }
    }
  
    // Auto-play (optional - comment out if not needed)
    // let autoplayInterval = setInterval(() => {
    //   const newIndex = currentIndex < carouselItems.length - 1 ? currentIndex + 1 : 0;
    //   updateCarousel(newIndex);
    // }, 5000);
  
    // // Pause autoplay on hover
    // if (carouselWrapper) {
    //   carouselWrapper.addEventListener('mouseenter', () => {
    //     clearInterval(autoplayInterval);
    //   });
    //   carouselWrapper.addEventListener('mouseleave', () => {
    //     autoplayInterval = setInterval(() => {
    //       const newIndex = currentIndex < carouselItems.length - 1 ? currentIndex + 1 : 0;
    //       updateCarousel(newIndex);
    //     }, 5000);
    //   });
    // }
  
    // Initialize carousel
    if (carouselItems.length > 0) {
      updateCarousel(0);
    }
  
    // Responsive adjustments
    function handleResponsive() {
      const windowWidth = window.innerWidth;
      
      carouselItems.forEach((item, index) => {
        const diff = index - currentIndex;
        let transform = '';
        
        if (windowWidth <= 768) {
          // Mobile layout - less separation
          if (diff === 0) {
            transform = 'translate(-50%, -50%) translateX(0) rotateY(0deg) scale(1)';
          } else if (diff === -1) {
            transform = 'translate(-50%, -50%) translateX(-150px) rotateY(20deg) scale(0.85)';
          } else if (diff === 1) {
            transform = 'translate(-50%, -50%) translateX(150px) rotateY(-20deg) scale(0.85)';
          } else if (diff < -1) {
            transform = 'translate(-50%, -50%) translateX(-300px) rotateY(30deg) scale(0.7)';
          } else {
            transform = 'translate(-50%, -50%) translateX(300px) rotateY(-30deg) scale(0.7)';
          }
        } else if (windowWidth <= 1024) {
          // Tablet layout
          if (diff === 0) {
            transform = 'translate(-50%, -50%) translateX(0) rotateY(0deg) scale(1)';
          } else if (diff === -1) {
            transform = 'translate(-50%, -50%) translateX(-180px) rotateY(18deg) scale(0.9)';
          } else if (diff === -2) {
            transform = 'translate(-50%, -50%) translateX(-360px) rotateY(28deg) scale(0.8)';
          } else if (diff === 1) {
            transform = 'translate(-50%, -50%) translateX(180px) rotateY(-18deg) scale(0.9)';
          } else if (diff === 2) {
            transform = 'translate(-50%, -50%) translateX(360px) rotateY(-28deg) scale(0.8)';
          } else if (diff < -2) {
            transform = 'translate(-50%, -50%) translateX(-540px) rotateY(38deg) scale(0.7)';
          } else {
            transform = 'translate(-50%, -50%) translateX(540px) rotateY(-38deg) scale(0.7)';
          }
        }
        
        if (transform && windowWidth <= 1024) {
          item.style.transform = transform;
        }
      });
    }
  
    // Listen to window resize
    window.addEventListener('resize', handleResponsive);
    handleResponsive();
  });
  
  // Export untuk digunakan oleh main.js
  window.carouselUpdateIndex = function(index) {
    const indicators = document.querySelectorAll('.indicator');
    const carouselItems = document.querySelectorAll('.carousel-3d-item');
    
    // Remove active from all
    carouselItems.forEach(item => item.classList.remove('active'));
    indicators.forEach(ind => ind.classList.remove('active'));
    
    // Add active to selected
    if (carouselItems[index]) {
      carouselItems[index].classList.add('active');
    }
    if (indicators[index]) {
      indicators[index].classList.add('active');
    }
  };

