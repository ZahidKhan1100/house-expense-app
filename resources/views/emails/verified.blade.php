<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Email Verified</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f9f9f9;
      margin: 0;
      padding: 0;
      text-align: center;
    }
    .container {
      max-width: 600px;
      margin: 50px auto;
      background: #fff;
      border-radius: 12px;
      padding: 40px 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 28px;
      color: #FF6A6A;
      margin-bottom: 15px;
    }
    p {
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 30px;
      color: #333;
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
      margin-top: 40px;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    @if ($status === 'success')
      <h1>🎉 Congrats {{ $name }}!</h1>
      <p>Your email has been successfully verified. You can now log in and start managing your house expenses.</p>
    @else
      <h1>Already Verified</h1>
      <p>Hello {{ $name }}, your email is already verified. You can log in to your account.</p>
    @endif

    <p class="footer">Thank you for joining <strong>Home Split</strong>.</p>
  </div>
</body>
</html>