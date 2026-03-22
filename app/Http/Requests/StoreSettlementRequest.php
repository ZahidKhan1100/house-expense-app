<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSettlementRequest extends FormRequest
{
    public function authorize()
    {
        // You can implement more complex logic here (e.g., user must be authenticated)
        return true;
    }

    public function rules()
    {
        return [
            'from_user_id' => 'required|exists:users,id',
            'to_user_id' => 'required|exists:users,id|different:from_user_id',
            'amount' => 'required|numeric|min:0.01',
            'expense_id' => 'nullable|exists:expenses,id',
        ];
    }

    public function messages()
    {
        return [
            'to_user_id.different' => 'You cannot pay yourself',
        ];
    }
}