<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\FormController;
use App\Http\Controllers\AdminController;
use Inertia\Inertia;
use App\Models\Region;
use Illuminate\Support\Facades\Redirect;
/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

// Route::get('/', function () {
//     return Inertia::render('Welcome', [
//         'canLogin' => Route::has('login'),
//         'canRegister' => Route::has('register'),
//         'laravelVersion' => Application::VERSION,
//         'phpVersion' => PHP_VERSION,
//     ]);
// });

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

//Routes for Admin
Route::group(['as' => 'admin.', 'prefix' => 'admin', 'middleware' => ['auth', 'verified','is.admin']], function () {
    Route::get('/', [AdminController::class, 'index'])->name('index');
    Route::get('/kab/{kab}', [AdminController::class, 'kab'])->name('kab');
    Route::get('/kec/{kab}/{kec}', [AdminController::class, 'kec'])->name('kec');
    Route::get('/desa/{kab}/{kec}/{desa}', [AdminController::class, 'desa'])->name('desa');
    Route::get('/export', [AdminController::class, 'export'])->name('export');
    Route::post('/export', [AdminController::class, 'download'])->name('export.download');
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
});

//Routes for PML
Route::middleware(['auth', 'verified', 'is.pml'])->group(function () {
    Route::get('/', function () {
        return Redirect::route('form.index');
    });
    //Routes for Profile
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    // Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    //Routes for Form
    Route::get('/form/{region_id?}', [FormController::class, 'index'])->name('form.index');
    Route::get('/form/create/{region_id}', [FormController::class, 'create'])->name('form.create');
    Route::post('/form/store/{region_id}/{id?}', [FormController::class, 'store'])->name('form.store');
    Route::post('/form/submit/{region_id}', [FormController::class, 'submit'])->name('form.submit');
    Route::delete('/form/destroy/{region_id}/{id}', [FormController::class, 'destroy'])->name('form.destroy');
    Route::get('/form/edit/{region_id}/{id}', [FormController::class, 'edit'])->name('form.edit');
    Route::post('/form/update/{region_id}/{nurt}', [FormController::class, 'update'])->name('form.update');
});

Route::get('/kecamatan/{kabupaten}', function (string $kabupaten) {
    $kecamatan = Region::all()->where('kabupaten', $kabupaten)->unique('kecamatan')->map(fn($kecamatan) =>[
        'id' => $kecamatan->kecamatan,
        'nama' => '['.$kecamatan->kecamatan.'] '.$kecamatan->nama_kecamatan
    ]);
    return response()->json(["kecamatan" => $kecamatan ]);
})->middleware(['auth', 'verified'])->name('kecamatan');

Route::get('/desa/{kabupaten}/{kecamatan}', function (string $kabupaten, string $kecamatan) {
    $desa = Region::all()->where('kabupaten', $kabupaten)->where('kecamatan', $kecamatan)->unique('desa')->map(fn($desa) =>[
        'id' => $desa->desa,
        'nama' => '['.$desa->desa.'] '.$desa->nama_desa
    ]);
    return response()->json(["desa" => $desa ]);
})->middleware(['auth', 'verified'])->name('desa');

Route::get('/blok/{kabupaten}/{kecamatan}/{desa}', function (string $kabupaten, string $kecamatan, string $desa) {
    $blok = Region::all()->where('kabupaten', $kabupaten)->where('kecamatan', $kecamatan)->where('desa', $desa)->map(fn($blok) =>[
        'id' => $blok->id,
        'nama' => $blok->nbs." / ".$blok->nks
    ]);
    return response()->json(["blok" => $blok ]);
})->middleware(['auth', 'verified'])->name('blok');

require __DIR__.'/auth.php';
