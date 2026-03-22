<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Record extends Model
{
    protected $fillable = [
        'expense_id',
        'added_by',
        'amount',
        'category_id',
        'description',
        'included_mates',
        'paid_by',
        'timestamp'
    ];

    protected $casts = [
        'included_mates' => 'array',
        'timestamp' => 'datetime',
    ];

    public function expense()
    {
        return $this->belongsTo(Expense::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function payer()
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}