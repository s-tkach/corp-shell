import { useShellUser } from "@corp/shell-sdk";

export default function AppEntry() {
  const user = useShellUser();

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>{{APP_NAME}}</h1>
      {user ? (
        <p>Logged in as: <strong>{user.email}</strong></p>
      ) : (
        <p>No user context available.</p>
      )}
    </div>
  );
}
