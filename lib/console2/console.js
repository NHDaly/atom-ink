'use babel'
/** @jsx etch.dom */

import etch from 'etch'
import { Raw } from '../util/etch.js'
import { CompositeDisposable } from 'atom'
import { Terminal } from 'xterm'
import * as fit from 'xterm/lib/addons/fit/fit'
import TerminalElement from './view'
import PaneItem from '../util/pane-item'
import ResizeDetector from 'element-resize-detector'
import { debounce, throttle } from 'underscore-plus'
import { closest } from './helpers'

let getTerminal = el => closest(el, 'ink-terminal').getModel()

Terminal.applyAddon(fit)

var subs

export default class InkTerminal extends PaneItem {
  static activate () {
    subs = new CompositeDisposable()
    subs.add(atom.commands.add('ink-terminal', {
      'ink-terminal:copy':  ({target}) => {
        let term = getTerminal(target)
        if (term != undefined) {
          term.copySelection()
        }},
      'ink-terminal:paste': ({target}) => {
        let term = getTerminal(target)
        if (term != undefined) {
          term.paste()
        }}
    }))

    subs.add(atom.workspace.onDidStopChangingActivePaneItem((item) => {
      if (item instanceof InkTerminal) {
        item.view.initialize(item)
        item.terminal.focus()
      }
    }))
  }

  static deactivate () {
    subs.dispose()
  }

  name = 'InkTerminal'

  constructor () {
    super()

    this.terminal = new Terminal({
      cursorBlink: false,
      cols: 100,
      rows: 30,
      scrollBack: 5000,
      tabStopWidth: 4
    })

    this.classname = ''

    this.enterhandler = (e) => {
      if (!this.ty && e.keyCode == 13) {
        if (this.startRequested) {
          this.startRequested()
        }
        return false
      }
    }
    this.terminal.attachCustomKeyEventHandler(this.enterhandler)

    this.view = new TerminalElement

    etch.initialize(this)
    etch.update(this).then(() => {
      this.view.initialize(this)
    })
  }

  set class (name) {
    this.classname = name
    this.view.className = name
  }

  update() {}

  render () {
    return <Raw>{this.view}</Raw>
  }

  getDefaultLocation () {
    return 'bottom'
  }

  onAttached () {
    this.view.initialize(this)
  }

  attachCustomKeyEventHandler (f, keepDefault = true) {
    this.terminal.attachCustomKeyEventHandler((e) => {
      f(e) && this.enterhandler(e)
    })
  }

  attach (ty) {
    if (!ty || !(ty.on)) {
      throw new Error('Tried attaching invalid pty.')
    }

    this.detach()

    this.ty = ty

    this.tyWrite = (data) => this.ty.write(data)
    this.tyResize = (size) => this.ty.resize(size.cols, size.rows)

    this.terminal.on('data', this.tyWrite)
    this.terminal.on('resize', this.tyResize)
    this.ty.on('data', (data) => this.terminal.write(data))
  }

  detach () {
    if (this.ty != undefined) {
      if (this.tyWrite != undefined) this.terminal.off('data', this.tyWrite)
      if (this.tyResize != undefined) this.terminal.off('resize', this.tyResize)
      this.ty = undefined
    }
  }

  execute (text) {
    if (this.ty === undefined) {
      throw new Error('Need to attach a pty before executing code.')
    }

    this.ty.write(text)
  }

  clear (hidePrompt = false) {
    this.terminal.clear()
    hidePrompt && this.terminal.write('\r' + ' '.repeat(this.terminal.cols - 3) + '\r')
  }

  copySelection () {
    if (this.terminal.hasSelection()) {
      atom.clipboard.write(this.terminal.getSelection())
      this.terminal.clearSelection()
    }
  }

  paste () {
    if (this.ty === undefined) {
      throw new Error('Need to attach a pty before pasting.')
    }

    this.ty.write(atom.clipboard.read())
  }

  show (view) {
    this.terminal.focus()
  }

  write (str) {
    this.terminal.write(str)
  }

  getTitle() {
    return 'Terminal'
  }

  getIconName() {
    return "terminal"
  }
}

InkTerminal.registerView()
atom.deserializers.add(InkTerminal)