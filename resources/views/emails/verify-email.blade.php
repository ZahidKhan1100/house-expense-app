<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Verify Your Email</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f9f9f9;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #fff;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      text-align: center;
    }
    h1 {
      color: #FF6A6A;
      margin-bottom: 10px;
    }
    p {
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 25px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(90deg, #FF6A6A, #FFB88C);
      color: #fff;
      text-decoration: none;
      font-weight: bold;
      padding: 14px 28px;
      border-radius: 8px;
      font-size: 16px;
      transition: all 0.3s ease;
    }
    .btn:hover {
      transform: scale(1.05);
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    .footer {
      font-size: 12px;
      color: #999;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Hello {{ $name }}!</h1>
    <p>Welcome to <strong>Home Split</strong>. Please verify your email by clicking the button below:</p>
    
    <a class="btn" href="{{ $verificationUrl }}">Verify My Email</a>
    
    <p class="footer">If you did not create this account, simply ignore this email. No action is needed.</p>
  </div>
</body>
</html>