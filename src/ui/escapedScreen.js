let _el

export const escapedScreen = {
  init(onPlayAgain) {
    _el = document.createElement('div')
    _el.className = 'screen'
    _el.style.background = 'rgba(0,0,0,0.85)'

    const title = document.createElement('h1')
    title.textContent = 'YOU ESCAPED'

    const btn = document.createElement('button')
    btn.className = 'btn'
    btn.textContent = 'PLAY AGAIN'
    btn.addEventListener('click', onPlayAgain)

    _el.append(title, btn)
    document.getElementById('ui').appendChild(_el)
  },

  show() { _el.classList.add('visible') },
  hide() { _el.classList.remove('visible') },
}
