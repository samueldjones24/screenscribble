!macro NSIS_HOOK_POSTINSTALL
  ExecShell "open" "$INSTDIR\\ScreenScribble.exe"
!macroend
