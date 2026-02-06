export function FacebookBadge() {
  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-full" data-testid="badge-facebook-v4">
      <div className="flex items-center gap-2">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#1877F2"/>
          <path d="M16.5 8.5H14.5C13.948 8.5 13.5 8.948 13.5 9.5V11H16.5L16 14H13.5V21.5H10.5V14H8V11H10.5V9C10.5 6.79 12.29 5 14.5 5H16.5V8.5Z" fill="white"/>
        </svg>
        <span className="text-sm font-medium text-foreground">Facebook Marketplace</span>
      </div>
      <div className="w-px h-5 bg-border" />
      <div className="flex items-center gap-2">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="messenger-gradient-v4" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0099FF"/>
              <stop offset="100%" stopColor="#A033FF"/>
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="11" fill="url(#messenger-gradient-v4)"/>
          <path d="M12 5C7.58 5 4 8.13 4 12C4 14.09 5.06 15.97 6.75 17.24V20L9.54 18.46C10.3 18.68 11.13 18.8 12 18.8C16.42 18.8 20 15.67 20 11.8C20 8.13 16.42 5 12 5ZM12.7 14.5L10.35 12L5.9 14.5L10.75 9.5L13.2 12L17.5 9.5L12.7 14.5Z" fill="white"/>
        </svg>
        <span className="text-sm font-medium text-foreground">Messenger</span>
      </div>
    </div>
  );
}
