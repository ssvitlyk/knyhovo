import { NotificationsHead } from './NotificationsHead';

/**
 * SettingsAuthRequired — shown when `GET /api/notifications/preferences`
 * returns 401. Informs the user they need to log in.
 */
export function SettingsAuthRequired(): React.JSX.Element {
  return (
    <div className="np-content">
      <NotificationsHead />
      <div className="al-note al-note--quiet">
        <div className="al-note__body">Увійдіть, щоб керувати сповіщеннями.</div>
      </div>
    </div>
  );
}
