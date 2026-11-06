"use client";

export function ContinueToHub({ action }: { action: string }) {
  return (
    <form
      method="post"
      action={action}
      className="mt-8"
      onSubmit={(event) => {
        const form = event.currentTarget;
        if (form.dataset.submitted === "1") {
          event.preventDefault();
          return;
        }
        form.dataset.submitted = "1";
        const button = form.querySelector("button");
        if (button) button.textContent = "Continuing...";
      }}
    >
      <button type="submit" className="w-full rounded-full bg-orange px-4 py-3 font-medium text-white">
        Continue to Hub
      </button>
    </form>
  );
}
