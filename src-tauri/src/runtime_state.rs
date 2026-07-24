#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppRuntimeState {
    Starting,
    Running,
    Paused,
    Exiting,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeAction {
    StartupComplete { paused: bool },
    Pause,
    Resume,
    BeginExit,
}

impl AppRuntimeState {
    pub fn transition(self, action: RuntimeAction) -> Self {
        match action {
            RuntimeAction::StartupComplete { paused } => {
                if paused {
                    AppRuntimeState::Paused
                } else {
                    AppRuntimeState::Running
                }
            }
            RuntimeAction::Pause => match self {
                AppRuntimeState::Exiting => AppRuntimeState::Exiting,
                _ => AppRuntimeState::Paused,
            },
            RuntimeAction::Resume => match self {
                AppRuntimeState::Exiting => AppRuntimeState::Exiting,
                _ => AppRuntimeState::Running,
            },
            RuntimeAction::BeginExit => AppRuntimeState::Exiting,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{AppRuntimeState, RuntimeAction};

    #[test]
    fn startup_moves_to_running_when_not_paused() {
        let state = AppRuntimeState::Starting.transition(RuntimeAction::StartupComplete { paused: false });
        assert_eq!(state, AppRuntimeState::Running);
    }

    #[test]
    fn startup_moves_to_paused_when_paused() {
        let state = AppRuntimeState::Starting.transition(RuntimeAction::StartupComplete { paused: true });
        assert_eq!(state, AppRuntimeState::Paused);
    }

    #[test]
    fn running_can_pause_and_resume() {
        let paused = AppRuntimeState::Running.transition(RuntimeAction::Pause);
        assert_eq!(paused, AppRuntimeState::Paused);

        let resumed = paused.transition(RuntimeAction::Resume);
        assert_eq!(resumed, AppRuntimeState::Running);
    }

    #[test]
    fn exit_is_terminal_for_pause_resume() {
        let exiting = AppRuntimeState::Running.transition(RuntimeAction::BeginExit);
        assert_eq!(exiting, AppRuntimeState::Exiting);

        assert_eq!(
            exiting.transition(RuntimeAction::Pause),
            AppRuntimeState::Exiting
        );
        assert_eq!(
            exiting.transition(RuntimeAction::Resume),
            AppRuntimeState::Exiting
        );
    }
}
