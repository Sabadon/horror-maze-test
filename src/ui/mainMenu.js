let _el, _muteBtn

export const mainMenu = {
  init(onNewGame, onMuteToggle) {
    _el = document.createElement('div')
    _el.className = 'screen'
    _el.style.background = 'rgba(0,0,0,0.82)'

    const title = document.createElement('h1')
    title.textContent = 'HORROR GAME'

    const newGameBtn = document.createElement('button')
    newGameBtn.className = 'btn'
    newGameBtn.textContent = 'NEW GAME'
    newGameBtn.addEventListener('click', onNewGame)

    _muteBtn = document.createElement('button')
    _muteBtn.className = 'btn'
    _muteBtn.textContent = 'MUTE'
    _muteBtn.addEventListener('click', onMuteToggle)

    _el.append(title, newGameBtn, _muteBtn)
    document.getElementById('ui').appendChild(_el)
  },

  setVisible(v)   { _el.classList.toggle('visible', v) },
  setMuted(muted) { _muteBtn.textContent = muted ? 'UNMUTE' : 'MUTE' },
}
