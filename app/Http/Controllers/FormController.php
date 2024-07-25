<?php

namespace App\Http\Controllers;

// use App\Models\Response;
// use App\Models\AgustusResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Region;
use Illuminate\Support\Facades\DB;


class FormController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(?string $region_id = null)
    {

        $pml = auth()->user()->name ;
        $kabupaten = Region::all()->where('kabupaten', auth()->user()->kabupaten)->unique('kabupaten')->map(fn($kabupaten) =>[
            'id' => $kabupaten->kabupaten,
            'nama' => '['.$kabupaten->kabupaten.'] '.$kabupaten->nama_kabupaten
        ]);
        $data = DB::table(getResponseTable())
                    ->select('region_id','nurt', 'docState', 'submit_status', 'updated_at', DB::raw('count(*) as jumlah_art'))
                    ->groupByRaw('region_id, nurt, docState, submit_status, updated_at')
                    ->where('region_id', '=', $region_id)
                    ->where('pml', '=', $pml)
                    ->get();
        $region = null;
        if ($region_id != null) {
            $region = Region::where('id', $region_id)->first();
        }
        return Inertia::render('Form/Index', [
            "kabupatens" => $kabupaten,
            "data" => $data,
            "region" => $region
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(string $region_id)
    {
        // dd ($request->all());
        $pml = auth()->user()->name ;
        $idbs = $region_id;
        // $pcl = User::all()->where('kabupaten', $region_id)->where('status', '2')->map(fn($pcl) =>[
        //     "label" => $pcl->name,
        //     "value" => $pcl->name,
        // ]);
        $kab = DB::scalar(
            "select kabupaten from regions where id =" . $region_id
        );
        if ($kab != auth()->user()->kabupaten) {
            return inertia_location('/');
        }
        $res = DB::table(getResponseTable())
                    ->select('nurt as label', 'nurt as value')
                    ->where('region_id','=', $region_id)
                    ->get()->toArray();
        $res = json_decode(json_encode($res), true);
        $nurt = [
            [
                'label' => "1",
                'value' => "1"
            ],
            [
                'label' => "2",
                'value' => "2"
            ],
            [
                'label' => "3",
                'value' => "3"
            ],
            [
                'label' => "4",
                'value' => "4"
            ],
            [
                'label' => "5",
                'value' => "5"
            ],
            [
                'label' => "6",
                'value' => "6"
            ],
            [
                'label' => "7",
                'value' => "7"
            ],
            [
                'label' => "8",
                'value' => "8"
            ],
            [
                'label' => "9",
                'value' => "9"
            ],
            [
                'label' => "10",
                'value' => "10"
            ]
         ];
        //  $nurt_done = array_diff($nurt, $res);
         foreach($nurt as $key => $n){
            foreach($res as $r){
                if($n['value'] == $r['value']){
                    unset($nurt[$key]);
                }
            }
         }

         $nurt = array_values($nurt);


        $pcl = DB::table('users')
                    ->select('name as label', 'name as value')
                    ->where('kabupaten','=', $kab)
                    ->where('status', '=', '2')
                    ->get();
                    
        $prefill = Region::all()->where('id', $idbs)->map(fn($prefill) =>[
            [
                "dataKey" =>"prov",
                "answer" => '['.$prefill->provinsi.'] '.$prefill->nama_provinsi
            ],
            [
                "dataKey" =>"kab",
                "answer" => '['.$prefill->kabupaten.'] '.$prefill->nama_kabupaten
            ],
            [
                "dataKey" =>"kec",
                "answer" => '['.$prefill->kecamatan.'] '.$prefill->nama_kecamatan
            ],
            [
                "dataKey" =>"desa",
                "answer" => '['.$prefill->desa.'] '.$prefill->nama_desa
            ],
            [
                "dataKey" =>"nbs",
                "answer" => $prefill->nbs
            ],
            [
                "dataKey" =>"nks",
                "answer" => $prefill->nks
            ],
            [
                "dataKey" =>"pml",
                "answer" => $pml
            ],
        ]);


        return Inertia::render(getViewPath(), [
            "prefill" => $prefill,
            "region_id" => $region_id,
            'pcl' => $pcl,
            'nurt' => $nurt
        ]);

    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request, string $region_id, $id = null)
    {
        try {
            $ResponseModel = getResponseModel();
            $req = $request->all();
            $answers = $req['answers'];
            $jumlah_art = array_column($answers, 'answer', 'dataKey')['jml_art'] ?? null;
    
            if (!$id) {
                for ($i = 0; $i < $jumlah_art; $i++) {
                    $response = new $ResponseModel;
                    $response->region_id = $region_id;
                    $response->nurt = array_column($answers, 'answer', 'dataKey')['nurt'][0]['value'] ?? null;
                    $response->hasil_kunjungan = array_column($answers, 'answer', 'dataKey')['hasil_kunjungan'][0]['value'] ?? null;
                    $response->pcl = array_column($answers, 'answer', 'dataKey')['pcl'][0]['value'] ?? null;
                    $response->pml = array_column($answers, 'answer', 'dataKey')['pml'] ?? null;
                    $response->no_art = $i + 1;
                    $no_urut = '#' . ($i + 1);
    
                    foreach ($answers as $key => $answer) {
                        if (str_ends_with($answer['dataKey'], $no_urut)) {
                            $dk = substr($answer['dataKey'], 0, -strlen($no_urut));
                            $response->$dk = is_array($answer['answer'])
                                ? (empty($answer['answer']) ? null : json_encode($answer['answer']))
                                : strval($answer['answer']);
                        }
                    }
                    $response->docState = $req['docState'];
                    $response->submit_status = '2';
                    $response->save();
                }
    
                return response()->json([
                    'message' => 'Data berhasil disimpan',
                    'id' => $response->nurt
                ], 201);
            } else {
                $pml = auth()->user()->name;
                // $ResponseModel::where('region_id', $region_id)->where('pml', '=', $pml)->where('nurt', $id)->delete();
                $req = $request->all();
                $answers = $req['answers'];

                $jumlah_art = array_column($answers, 'answer', 'dataKey')['jml_art'] ?? null;
                $nurt = array_column($answers, 'answer', 'dataKey')['nurt'][0]['value'] ?? null;
                $hasil_kunjungan = array_column($answers, 'answer', 'dataKey')['hasil_kunjungan'][0]['value'] ?? null;
                if ($hasil_kunjungan != '1') {
                    $response = new $ResponseModel;
                    $response->region_id = $region_id;
                    $response->nurt = $nurt;
                    $response->hasil_kunjungan = $hasil_kunjungan;
                    $response->pcl = array_column($answers, 'answer', 'dataKey')['pcl'][0]['value'] ?? null;
                    $response->pml = array_column($answers, 'answer', 'dataKey')['pml'] ?? null;
                    $response->docState = $req['docState'];
                    $response->submit_status = '2';
                    $response->save();
                    $jumlah_art = 0;
                }
                else {
                    $ResponseModel::where('region_id', $region_id)
                    ->where('pml', $pml)
                    ->where('nurt', $id)
                    ->where('hasil_kunjungan', '!=', '1')
                    ->delete();
                    
                    for ($i = 0; $i < $jumlah_art; $i++) {
                        $response = $ResponseModel::firstOrNew([
                            'region_id' => $region_id, 
                            'pml' => $pml, 
                            'nurt' => $id, 
                            'no_art' => $i+1
                        ]);
                        $response->region_id = $region_id;
                        $response->nurt = $nurt;
                        $response->hasil_kunjungan = $hasil_kunjungan;
                        $response->pcl = array_column($answers, 'answer', 'dataKey')['pcl'][0]['value'] ?? null;
                        $response->pml = array_column($answers, 'answer', 'dataKey')['pml'] ?? null;
                        $response->no_art = $i + 1;
                        $no_urut = '#' . ($i + 1);
                    
                        foreach ($answers as $key => $answer) {
                        if (str_ends_with($answer['dataKey'], $no_urut)) {
                            $dk = substr($answer['dataKey'], 0, -strlen($no_urut));
                            $response->$dk = is_array($answer['answer'])
                                ? (empty($answer['answer']) ? null : json_encode($answer['answer']))
                                : strval($answer['answer']);
                        }
                        }
                        $response->docState = $req['docState'];
                        $response->submit_status = '2';
                        $response->save();
                    }
                }

                $ResponseModel::where('region_id', $region_id)
                ->where('pml', $pml)
                ->where('nurt', $id)
                ->where('no_art', '>', $jumlah_art)
                ->delete();

                return response()->json([
                    'message' => 'Data berhasil disimpan',
                    'id' => $response->nurt
                ], 201);
            }
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }

    }
    public function submit(Request $request, string $region_id)
    {
        try {
            $ResponseModel = getResponseModel();
            $req = $request->all();
            $answers = $req['answers'];
            $jumlah_art = array_column($answers, 'answer', 'dataKey')['jml_art'] ?? null;
            $hasil_kunjungan = array_column($answers, 'answer', 'dataKey')['hasil_kunjungan'][0]['value'] ?? null;
            $pml = array_column($answers, 'answer', 'dataKey')['pml'] ?? null;
            $nurt = array_column($answers, 'answer', 'dataKey')['nurt'][0]['value'] ?? null;
        
            if ($hasil_kunjungan != '1') {
                $response = $ResponseModel::firstOrNew([
                    'region_id' => $region_id,
                    'pml' => $pml,
                    'nurt' => $nurt,
                    'hasil_kunjungan' => $hasil_kunjungan
                ]);
                $response->region_id = $region_id;
                $response->nurt = $nurt;
                $response->hasil_kunjungan = $hasil_kunjungan;
                $response->pcl = array_column($answers, 'answer', 'dataKey')['pcl'][0]['value'] ?? null;
                $response->pml = $pml;
                $response->docState = $req['docState'];
                $response->submit_status = '1';
                $response->save();
            } else {
                for($i = 0; $i < $jumlah_art; $i++) {
                    $response = new $ResponseModel;
                    $response->region_id = $region_id;
                    $response->nurt = array_column($answers, 'answer', 'dataKey')['nurt'][0]['value'] ?? null;
                    $response->hasil_kunjungan = $hasil_kunjungan;
                    $response->pcl = array_column($answers, 'answer', 'dataKey')['pcl'][0]['value'] ?? null;
                    $response->pml = array_column($answers, 'answer', 'dataKey')['pml'] ?? null;
                    $response->no_art = $i + 1;
                    $no_urut = '#'.($i+1);
                    foreach($answers as $key => $answer) {
                        if(str_ends_with($answer['dataKey'], $no_urut)) {
                            $dk = substr($answer['dataKey'], 0, -strlen($no_urut));
                            $response->$dk = strval($answer['answer']);
                        }
                    }
                    $response->docState = $req['docState'];
                    $response->submit_status = '1';
                    $response->save();
                }
            }
        
            return response()->json([
                'message' => 'Data berhasil disubmit',
                'id' => $response->nurt
            ], 201);
        
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error submitting data',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $region_id, string $id)
    {
        $pml = auth()->user()->name ;
        $idbs = $region_id;
        // $pcl = User::all()->where('kabupaten', $region_id)->where('status', '2')->map(fn($pcl) =>[
        //     "label" => $pcl->name,
        //     "value" => $pcl->name,
        // ]);
        $kab = DB::scalar(
            "select kabupaten from regions where id =" . $region_id
        );
        if ($kab != auth()->user()->kabupaten) {
            return inertia_location('/');
        }
        $res = DB::table(getResponseTable())
                    ->select('nurt as label', 'nurt as value')
                    ->where('region_id','=', $region_id)
                    ->where('nurt', '!=', $id)
                    ->get()->toArray();
        $res = json_decode(json_encode($res), true);
        $nurt = [
            [
                'label' => "1",
                'value' => "1"
            ],
            [
                'label' => "2",
                'value' => "2"
            ],
            [
                'label' => "3",
                'value' => "3"
            ],
            [
                'label' => "4",
                'value' => "4"
            ],
            [
                'label' => "5",
                'value' => "5"
            ],
            [
                'label' => "6",
                'value' => "6"
            ],
            [
                'label' => "7",
                'value' => "7"
            ],
            [
                'label' => "8",
                'value' => "8"
            ],
            [
                'label' => "9",
                'value' => "9"
            ],
            [
                'label' => "10",
                'value' => "10"
            ]
         ];
        //  $nurt_done = array_diff($nurt, $res);
         foreach($nurt as $key => $n){
            foreach($res as $r){
                if($n['value'] == $r['value']){
                    unset($nurt[$key]);
                }
            }
         }

        $nurt = array_values($nurt);

        $pcl = DB::table('users')
                    ->select('name as label', 'name as value')
                    ->where('kabupaten','=', $kab)
                    ->where('status', '=', '2')
                    ->get();

        $response = [];
        $data = DB::table(getResponseTable())
                    ->where('region_id', '=', $region_id)
                    ->where('pml', '=', $pml)
                    ->where('nurt', "=", $id )
                    ->get();
        $hasil_kunjungan = $data[0]->hasil_kunjungan;
        if ($hasil_kunjungan != '1') {
            $jml_art = 0;
        }
        else {
            $jml_art = sizeof($data);
        }

        $field = array('id', 'region_id', 'pcl', 'pml', 'nurt', 'no_art', 'hasil_kunjungan');
        $response = [
            [
                "dataKey" => "nurt",
                "answer" => [
                    [
                        "label" => $data[0]->nurt,
                        "value" => $data[0]->nurt
                    ]
                ]
            ],
            [
                "dataKey" => "hasil_kunjungan",
                "answer" => [
                    [
                        "label" => $data[0]->hasil_kunjungan,
                        "value" => $data[0]->hasil_kunjungan
                    ]
                ]
            ],
            [
                "dataKey" => "pcl",
                "answer" => [
                    [
                        "label" => $data[0]->pcl,
                        "value" => $data[0]->pcl
                    ]
                ]
            ],
            [
                "dataKey" => "jml_art",
                "answer" => $jml_art
            ],
        ];

        foreach ($data as $k => $datum) {
            foreach ($datum as $key => $value) {
                    if (!in_array($key, $field) ) {
                        $r = [];
                        $r["dataKey"] = $key.'#'.$k+1;
                        $r["answer"] = $value;
                        $response [] = $r;
                    }
            }
        };
        // dd($response);

        $prefill = Region::all()->where('id', $idbs)->map(fn($prefill) =>[
            [
                "dataKey" =>"prov",
                "answer" => '['.$prefill->provinsi.'] '.$prefill->nama_provinsi
            ],
            [
                "dataKey" =>"kab",
                "answer" => '['.$prefill->kabupaten.'] '.$prefill->nama_kabupaten
            ],
            [
                "dataKey" =>"kec",
                "answer" => '['.$prefill->kecamatan.'] '.$prefill->nama_kecamatan
            ],
            [
                "dataKey" =>"desa",
                "answer" => '['.$prefill->desa.'] '.$prefill->nama_desa
            ],
            [
                "dataKey" =>"nbs",
                "answer" => $prefill->nbs
            ],
            [
                "dataKey" =>"nks",
                "answer" => $prefill->nks
            ],
            [
                "dataKey" =>"pml",
                "answer" => $pml
            ]
        ]);

        return Inertia::render(getViewPath(), [
            "prefill" => $prefill,
            "response" => $response,
            "region_id" => $region_id,
            'pcl' => $pcl,
            'nurt' => $nurt
        ]);

    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $region_id, string $id)
    {
        try {
            $ResponseModel = getResponseModel();
            $pml = auth()->user()->name;
            
            $req = $request->all();
            $answers = $req['answers'];
            $jumlah_art = array_column($answers, 'answer', 'dataKey')['jml_art'] ?? null;
            $nurt = array_column($answers, 'answer', 'dataKey')['nurt'][0]['value'] ?? null;
            $hasil_kunjungan = array_column($answers, 'answer', 'dataKey')['hasil_kunjungan'][0]['value'] ?? null;
        
            if ($hasil_kunjungan != '1') {
                $response = $ResponseModel::firstOrNew([
                    'region_id' => $region_id,
                    'pml' => $pml,
                    'nurt' => $id,
                    'hasil_kunjungan' => $hasil_kunjungan
                ]);
                $response->region_id = $region_id;
                $response->nurt = $nurt;
                $response->hasil_kunjungan = $hasil_kunjungan;
                $response->pcl = array_column($answers, 'answer', 'dataKey')['pcl'][0]['value'] ?? null;
                $response->pml = array_column($answers, 'answer', 'dataKey')['pml'] ?? null;
                $response->docState = $req['docState'];
                $response->submit_status = '1';
                $response->save();
                $jumlah_art = 0;
            } else {
                $ResponseModel::where('region_id', $region_id)
                    ->where('pml', $pml)
                    ->where('nurt', $id)
                    ->where('hasil_kunjungan', '!=', '1')
                    ->delete();
        
                for ($i = 0; $i < $jumlah_art; $i++) {
                    $response = $ResponseModel::firstOrNew([
                        'region_id' => $region_id,
                        'pml' => $pml,
                        'nurt' => $id,
                        'no_art' => $i+1
                    ]);
                    $response->region_id = $region_id;
                    $response->nurt = $nurt;
                    $response->hasil_kunjungan = array_column($answers, 'answer', 'dataKey')['hasil_kunjungan'][0]['value'] ?? null;
                    $response->pcl = array_column($answers, 'answer', 'dataKey')['pcl'][0]['value'] ?? null;
                    $response->pml = array_column($answers, 'answer', 'dataKey')['pml'] ?? null;
                    $response->no_art = $i + 1;
                    $no_urut = '#' . ($i + 1);
               
                    foreach ($answers as $key => $answer) {
                        if (str_ends_with($answer['dataKey'], $no_urut)) {
                            $dk = substr($answer['dataKey'], 0, -strlen($no_urut));
                            $response->$dk = is_array($answer['answer'])
                                ? (empty($answer['answer']) ? null : json_encode($answer['answer']))
                                : strval($answer['answer']);
                        }
                    }
                    $response->docState = $req['docState'];
                    $response->submit_status = '1';
                    $response->save();
                }
            }
        
            $ResponseModel::where('region_id', $region_id)
                ->where('pml', $pml)
                ->where('nurt', $id)
                ->where('no_art', '>', $jumlah_art)
                ->delete();
        
            return response()->json([
                'message' => 'Data berhasil disubmit',
                'id' => $response->nurt
            ], 201);
        
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error submitting data',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $region_id, string $id)
    {
        $ResponseModel = getResponseModel();
        $pml = auth()->user()->name ;
        $ResponseModel::where('region_id', $region_id)->where('pml', '=', $pml)->where('nurt', $id)->delete();
        return redirect()->route('form.index', ['region_id' => $region_id]);
    }
}
