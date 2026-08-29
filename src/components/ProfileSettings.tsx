import { FormEvent, useState } from "react";
import { Check, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { scrollFocusedFieldIntoView } from "@/lib/scrollFocusedFieldIntoView";

const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,23}$/;

type ProfileSettingsProps = {
  userId: string;
  username: string;
  displayName: string;
  onSaved: (profile: { username: string; displayName: string }) => void;
  onNotice: (message: string) => void;
};

export function ProfileSettings({
  userId,
  username: savedUsername,
  displayName: savedDisplayName,
  onSaved,
  onNotice,
}: ProfileSettingsProps) {
  const [username, setUsername] = useState(savedUsername);
  const [displayName, setDisplayName] = useState(savedDisplayName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedDisplayName = displayName.trim();
  const unchanged =
    normalizedUsername === savedUsername &&
    normalizedDisplayName === savedDisplayName;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setError(
        "Use 3-24 lowercase letters, numbers, or underscores. Start with a letter.",
      );
      return;
    }

    if (!normalizedDisplayName || normalizedDisplayName.length > 80) {
      setError("Display name must be between 1 and 80 characters.");
      return;
    }

    setBusy(true);

    try {
      if (normalizedUsername !== savedUsername) {
        const availability = await supabase.rpc("is_username_available", {
          candidate: normalizedUsername,
        });

        if (availability.error) throw availability.error;
        if (!availability.data) {
          setError("That username is already taken.");
          return;
        }
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          username: normalizedUsername,
          display_name: normalizedDisplayName,
        })
        .eq("id", userId)
        .select("username,display_name")
        .single();

      if (updateError) throw updateError;

      const nextProfile = {
        username: data.username,
        displayName: data.display_name ?? "",
      };
      setUsername(nextProfile.username);
      setDisplayName(nextProfile.displayName);
      setSuccess("Profile saved.");
      onSaved(nextProfile);
      onNotice("Profile saved");
    } catch (caught) {
      const profileError = caught as { code?: string; message?: string };
      setError(
        profileError.code === "23505"
          ? "That username is already taken."
          : profileError.message ?? "Could not save your profile. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-header compact">
        <div>
          <p className="section-label">Account settings</p>
          <h1>Your profile</h1>
          <p>Manage the name and username people know you by on Momentum.</p>
        </div>
      </header>

      <section className="journal-section profile-settings" aria-labelledby="profile-details-title">
        <div className="section-heading">
          <div>
            <p className="section-label">Basic identity</p>
            <h2 id="profile-details-title">Profile details</h2>
          </div>
        </div>

        <form
          className="profile-form"
          onSubmit={saveProfile}
          onFocusCapture={scrollFocusedFieldIntoView}
        >
          <label>
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              maxLength={80}
              required
            />
            <small className="field-hint">Shown to friends as your name.</small>
          </label>

          <label>
            Username
            <span className="username-input">
              <span aria-hidden="true">@</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                minLength={3}
                maxLength={24}
                pattern="[a-z][a-z0-9_]{2,23}"
                required
              />
            </span>
            <small className="field-hint">
              3-24 characters. Lowercase letters, numbers, and underscores.
            </small>
          </label>

          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {success ? (
            <div className="form-success" role="status">
              <Check size={16} aria-hidden="true" />
              {success}
            </div>
          ) : null}

          <div className="profile-form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={busy || unchanged}
            >
              <Save size={16} aria-hidden="true" />
              {busy ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
