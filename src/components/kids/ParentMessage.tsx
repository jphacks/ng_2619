
"use client";

import { useState } from "react";

export default function ParentMessage() {
  const [time, setTime] = useState("17時に");
  const [place, setPlace] = useState("お庭で");

  const message = `${time}、${place}見てほしい！`;

  return (
    <div className="space-y-5 rounded-2xl border p-5">
      <h2 className="text-xl font-bold">
        おうちのひとにみてほしい！
      </h2>

      <p>いつ見てほしい？</p>
      <div className="flex flex-wrap gap-2">
        {["いま", "17時に", "帰ってきたら", "あとで"].map(
          (item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTime(item)}
              className={`rounded-xl border px-4 py-3 ${
                time === item
                  ? "bg-green-200 border-green-500"
                  : "bg-white"
              }`}
            >
              {item}
            </button>
          )
        )}
      </div>

      <p>どこで見てほしい？</p>
      <div className="flex flex-wrap gap-2">
        {["お庭で", "お部屋で", "学校で"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPlace(item)}
            className={`rounded-xl border px-4 py-3 ${
              place === item
                ? "bg-green-200 border-green-500"
                : "bg-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-gray-100 p-4">
        <p className="text-sm text-gray-500">
          おくるメッセージ
        </p>
        <p className="text-lg font-bold">{message}</p>
      </div>
      {/* ここにidを付与して親側に送れるようにする */}

    </div>
  );
}
