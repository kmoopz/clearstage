Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"

!ifndef APP_NAME
  !define APP_NAME "澄幕 ClearStage"
!endif
!ifndef APP_EXE
  !define APP_EXE "ClearStage.exe"
!endif
!ifndef APP_VERSION
  !define APP_VERSION "0.1.0"
!endif
!ifndef APP_DIR
  !define APP_DIR "ClearStage"
!endif
!ifndef SOURCE_DIR
  !define SOURCE_DIR "..\release\ClearStage-win32-x64"
!endif
!ifndef OUT_FILE
  !define OUT_FILE "..\release\ClearStage-Setup-0.1.0.exe"
!endif
!ifndef ICON_FILE
  !define ICON_FILE "..\build\icon.ico"
!endif

Name "${APP_NAME}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP_DIR}"
InstallDirRegKey HKCU "Software\ClearStage" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!define MUI_ABORTWARNING
!define MUI_ICON "${ICON_FILE}"
!define MUI_UNICON "${ICON_FILE}"
!define MUI_WELCOMEPAGE_TITLE "${APP_NAME}"
!define MUI_WELCOMEPAGE_TEXT "安装澄幕 ClearStage ${APP_VERSION} 公测版。$\r$\n$\r$\n这是一个本地优先的 B 站直播观看、录制与切片工作台。安装到当前用户目录，不需要管理员权限。安装程序会把 ClearStage 代码签名证书加入当前用户的受信任存储，让 Windows 识别发布者。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "启动澄幕 ClearStage"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  File /r "${SOURCE_DIR}\*.*"
  File "/oname=$INSTDIR\clearstage.ico" "${ICON_FILE}"

  ; The app and installer are signed with this self-signed certificate. Trust it
  ; for the current user so Windows recognizes the publisher after installation.
  DetailPrint "正在安装 ClearStage 代码签名证书..."
  nsExec::ExecToLog '"$SYSDIR\certutil.exe" -user -addstore "Root" "$INSTDIR\ClearStage-CodeSigning.cer"'
  Pop $0
  nsExec::ExecToLog '"$SYSDIR\certutil.exe" -user -addstore "TrustedPublisher" "$INSTDIR\ClearStage-CodeSigning.cer"'
  Pop $0

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\clearstage.ico" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\卸载 ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\clearstage.ico" 0

  WriteRegStr HKCU "Software\ClearStage" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClearStage" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClearStage" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClearStage" "Publisher" "ClearStage"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClearStage" "DisplayIcon" "$INSTDIR\clearstage.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClearStage" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClearStage" "QuietUninstallString" "$\"$INSTDIR\Uninstall.exe$\" /S"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClearStage" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClearStage" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\卸载 ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClearStage"
  DeleteRegKey HKCU "Software\ClearStage"
  RMDir /r "$INSTDIR"
SectionEnd
