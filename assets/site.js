(() => {
  const header = document.querySelector('.site-header')
  const nav = document.querySelector('.site-nav')
  const toggle = document.querySelector('.mobile-toggle')

  const onScroll = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 18)
  }
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })

  toggle?.addEventListener('click', () => {
    nav?.classList.toggle('is-open')
    toggle.setAttribute('aria-expanded', String(nav?.classList.contains('is-open')))
  })
  nav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => nav.classList.remove('is-open'))
  })

  // Mark the current top-level navigation item.
  const current = location.pathname.split('/').pop() || 'index.html'
  document.querySelectorAll('.site-nav a').forEach((link) => {
    const href = (link.getAttribute('href') || '').split('#')[0]
    if (href === current) link.classList.add('is-active')
  })
  document.querySelectorAll('a[href^="http"]').forEach((link) => {
    if (!link.hasAttribute('rel')) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    }
  })

  // Gentle reveal on scroll. Content is fully visible without JS if motion is disabled.
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const reveals = document.querySelectorAll('[data-reveal]')
  if (prefersReduced || !('IntersectionObserver' in window)) {
    reveals.forEach((node) => node.classList.add('is-visible'))
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px' }
    )
    reveals.forEach((node) => observer.observe(node))
  }

  // Docs table of contents.
  const toc = document.querySelector('.docs-toc')
  if (toc) {
    const links = [...toc.querySelectorAll('a')]
    const sections = links
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean)
    if ('IntersectionObserver' in window && sections.length) {
      const tocObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const id = `#${entry.target.id}`
            links.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === id))
          })
        },
        { rootMargin: '-25% 0px -60% 0px', threshold: 0 }
      )
      sections.forEach((section) => tocObserver.observe(section))
    }
  }

  // FAQ search + category filter.
  const search = document.querySelector('.faq-search')
  const categories = document.querySelector('.faq-categories')
  if (search) {
    const items = [...document.querySelectorAll('.faq-page-list .faq-item')]
    const noResult = document.querySelector('.faq-no-result')
    let category = 'all'
    const apply = () => {
      const query = search.value.trim().toLowerCase()
      let visible = 0
      items.forEach((item) => {
        const text = item.textContent?.toLowerCase() || ''
        const tags = (item.dataset.category || '').split(' ')
        const matchesQuery = !query || text.includes(query)
        const matchesCategory = category === 'all' || tags.includes(category)
        const show = matchesQuery && matchesCategory
        item.hidden = !show
        if (show) visible += 1
      })
      noResult?.classList.toggle('is-visible', visible === 0)
    }
    search.addEventListener('input', apply)
    categories?.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        category = button.dataset.category || 'all'
        categories.querySelectorAll('button').forEach((item) => item.classList.remove('is-active'))
        button.classList.add('is-active')
        apply()
      })
    })
    apply()
  }

  // Copy checksum / install token.
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const value = button.getAttribute('data-copy') || ''
      try {
        await navigator.clipboard.writeText(value)
        const previous = button.textContent
        button.textContent = '已复制'
        setTimeout(() => (button.textContent = previous), 1600)
      } catch {
        // Clipboard permissions can be denied in file:// previews.
      }
    })
  })

  const year = document.querySelector('[data-year]')
  if (year) year.textContent = String(new Date().getFullYear())

  // Subtle pointer parallax for the hero product window (disabled for reduced motion).
  const hero = document.querySelector('.hero')
  const windowFrame = document.querySelector('.hero-window')
  if (hero && windowFrame && !prefersReduced) {
    hero.addEventListener('pointermove', (event) => {
      const rect = hero.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width - 0.5
      const y = (event.clientY - rect.top) / rect.height - 0.5
      windowFrame.style.transform = `perspective(1400px) rotateY(${(-3 + x * 1.6).toFixed(2)}deg) rotateX(${(1 - y * 1.3).toFixed(2)}deg)`
    })
    hero.addEventListener('pointerleave', () => {
      windowFrame.style.transform = 'perspective(1400px) rotateY(-3deg) rotateX(1deg)'
    })
  }
})()
