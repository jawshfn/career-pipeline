import React from "react";

export default function LoadingState({ message = "Loading..." }) {
  return (
    <div className="message message-loading" role="status">
      {message}
    </div>
  );
}
