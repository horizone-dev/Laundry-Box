import os, glob, sqlite3
paths = glob.glob(os.path.join(os.environ['APPDATA'], '**', '*.sqlite'), recursive=True)
for p in paths:
    try:
        c = sqlite3.connect(p)
        tables = [t[0] for t in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        if 'email_settings' in tables:
            print(f'{p}: Found email_settings!')
            print('   ', c.execute('SELECT * FROM email_settings').fetchall())
    except Exception as e:
        pass
