let _el, _inner

export const gameOverScreen = {
  init(onRetry) {
    _el = document.createElement('div')
    _el.className = 'screen'

    _inner = document.createElement('div')
    _inner.style.cssText = 'display:none;flex-direction:column;align-items:center;'

    const title = document.createElement('h1')
    title.textContent = 'YOU DIED'
    title.style.color = '#c00'

    const retryBtn = document.createElement('button')
    retryBtn.className = 'btn'
    retryBtn.textContent = 'RETRY'
    retryBtn.addEventListener('click', onRetry)

    _inner.append(title, retryBtn)
    _el.appendChild(_inner)
    document.getElementById('ui').appendChild(_el)
  },

  show() {
    _el.classList.add('visible')
    _el.style.animation = 'deathFlash 0.8s ease-out forwards'
    setTimeout(() => { _inner.style.display = 'flex' }, 900)
  },

  hide() {
    _el.classList.remove('visible')
    _inner.style.display = 'none'
    _el.style.animation = ''
  },
}
